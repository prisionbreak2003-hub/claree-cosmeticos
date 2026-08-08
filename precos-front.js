// precos-front.js — preço flutuante compartilhado (landing + checkout).
// Espelha o algoritmo do admin/oferta da Hidrabene: sobe 1 centavo por bloco de 5min
// dentro da faixa [base, teto], pula valores redondos (…0/…5) e bloqueados (aviso de golpe
// no gateway). NÃO altere aqui sem alinhar com admin.html/oferta.html.
var PRECOS_API = { v0: 6693, v1: 5493, v2: 3793, v0_max: 6733, v1_max: 5533, v2_max: 3833, sedex: 1192 };

function fmtBRL(cents){ var r=Math.floor(cents/100), c=String(cents%100).padStart(2,'0'); return 'R$ '+r+','+c; }
function sanitizarPrecoQuebrado(cents){ var d=cents%10; if(d===0)cents+=3; else if(d===5)cents+=2; return cents; }
var OFFSETS_KITS = { v0:[0,83,147,219,313,387], v1:[0,73,127,189,263,327], v2:[0,53,97,139,193,247] };
var BLOQUEADOS_PADRAO = [6094, 6733];
function isBloqueado(cents){ if(BLOQUEADOS_PADRAO.indexOf(cents)!==-1) return true; var l=PRECOS_API.bloqueados; return Array.isArray(l)&&l.indexOf(cents)!==-1; }
function evitarBloqueado(preco){ var g=0; while(isBloqueado(preco)&&g<80){ preco=sanitizarPrecoQuebrado(preco+1); g++; } return preco; }
function precoPasseio(base,teto,blocoEff){
  var validos=[]; for(var p=base;p<=teto&&validos.length<20000;p++){ if(p%10!==0&&p%10!==5&&!isBloqueado(p)) validos.push(p); }
  if(!validos.length) return base;
  var i=((blocoEff%validos.length)+validos.length)%validos.length; return validos[i];
}
function getPrecoFlutuante(precoBase,indexKit,bloco){
  var precoMax=PRECOS_API['v'+indexKit+'_max'];
  if(precoMax&&precoMax>precoBase){ return precoPasseio(precoBase,precoMax,bloco+indexKit*7919); }
  else if(precoMax&&precoMax<=precoBase){ return precoMax; }
  else { var list=OFFSETS_KITS['v'+indexKit]; var idx=((bloco%list.length)+list.length)%list.length; return evitarBloqueado(sanitizarPrecoQuebrado(precoBase+list[idx])); }
}
function blocoEff(){
  var bloco=Math.floor(Date.now()/(5*60*1000));
  var seed=PRECOS_API.updated_at?Math.floor(new Date(PRECOS_API.updated_at).getTime()/1000):0;
  return bloco+seed;
}
// preço flutuante atual (centavos) da variante do precos: 0=3kits, 1=2kits, 2=1kit
function precoAtual(vIdx){ return getPrecoFlutuante(PRECOS_API['v'+vIdx], vIdx, blocoEff()); }
// busca /api/precos e chama cb() (com PRECOS_API já atualizado, ou no default se falhar)
function loadPrecos(cb){
  try{ fetch('/api/precos').then(function(r){return r.json();}).then(function(d){ if(d&&d.v0)PRECOS_API=d; if(cb)cb(); }).catch(function(){ if(cb)cb(); }); }
  catch(e){ if(cb)cb(); }
}
