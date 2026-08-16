// Espelho server-side de precos-front.js — MESMA lógica, pra recalcular o preço
// autoritativo na hora de criar a cobrança (nunca confia no valor vindo do navegador).
// Se um dia mexer nos preços/tabela, atualize os dois arquivos juntos.

var PRECOS_BASE = { v0: 6693, v1: 5493, v2: 3793, v0_max: 6733, v1_max: 5533, v2_max: 3833, sedex: 1192 };
var OFFSETS_KITS = { v0: [0, 83, 147, 219, 313, 387], v1: [0, 73, 127, 189, 263, 327], v2: [0, 53, 97, 139, 193, 247] };
var BLOQUEADOS_PADRAO = [6094, 6733];

function sanitizarPrecoQuebrado(cents) {
  var d = cents % 10;
  if (d === 0) cents += 3; else if (d === 5) cents += 2;
  return cents;
}
function isBloqueado(cents) { return BLOQUEADOS_PADRAO.indexOf(cents) !== -1; }
function evitarBloqueado(preco) {
  var g = 0;
  while (isBloqueado(preco) && g < 80) { preco = sanitizarPrecoQuebrado(preco + 1); g++; }
  return preco;
}
function precoPasseio(base, teto, blocoEff) {
  var validos = [];
  for (var p = base; p <= teto && validos.length < 20000; p++) {
    if (p % 10 !== 0 && p % 10 !== 5 && !isBloqueado(p)) validos.push(p);
  }
  if (!validos.length) return base;
  var i = ((blocoEff % validos.length) + validos.length) % validos.length;
  return validos[i];
}
function getPrecoFlutuante(precoBase, indexKit, bloco) {
  var precoMax = PRECOS_BASE['v' + indexKit + '_max'];
  if (precoMax && precoMax > precoBase) return precoPasseio(precoBase, precoMax, bloco + indexKit * 7919);
  if (precoMax && precoMax <= precoBase) return precoMax;
  var list = OFFSETS_KITS['v' + indexKit];
  var idx = ((bloco % list.length) + list.length) % list.length;
  return evitarBloqueado(sanitizarPrecoQuebrado(precoBase + list[idx]));
}
function blocoEff() { return Math.floor(Date.now() / (5 * 60 * 1000)); }

// vIdx: 0=3kits, 1=2kits, 2=1kit (mesma convenção do precos-front.js)
function precoAtual(vIdx) { return getPrecoFlutuante(PRECOS_BASE['v' + vIdx], vIdx, blocoEff()); }

// kitIndex (0,1,2 = 1kit,2kits,3kits, mesma ordem do array KITS em index.html) -> vIdx
var K2V = [2, 1, 0];
var KITS = [
  { n: '1 Kit Completo', q: 1 },
  { n: '2 Kits Completos', q: 2 },
  { n: '3 Kits Completos', q: 3 },
];

function precoDoKit(kitIndex) {
  var kit = KITS[kitIndex];
  if (!kit) return null;
  return { nome: kit.n, precoCentavos: precoAtual(K2V[kitIndex]) };
}

function sedexCentavos() { return PRECOS_BASE.sedex; }

module.exports = { precoAtual, precoDoKit, sedexCentavos };
