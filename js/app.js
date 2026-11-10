// Logica della cassa (carrello, pagamento, scanner QR, stampa QR).
// Richiede: vendor/jsQR.js, vendor/qrcode.js, js/products.js
var PREFIX="cassa:";
var cart={},given=0,cat="tutti";
var $=function(i){return document.getElementById(i)};
function eur(c){return (c/100).toLocaleString("it-IT",{style:"currency",currency:"EUR"})}
function find(id){return PRODUCTS.filter(function(p){return p.id===id})[0]}

function buildGrid(el,onclick){
 el.innerHTML="";
 PRODUCTS.filter(function(p){return cat==="tutti"||p.cat===cat}).forEach(function(p){
  var b=document.createElement("button");b.className="prod";b.dataset.id=p.id;
  b.innerHTML='<span class="e">'+p.e+'</span><span class="n">'+p.n+'</span><span class="p">'+eur(p.c)+'</span>';
  b.onclick=function(){onclick(p)};el.appendChild(b);
 });
}

function addItem(p){
  cart[p.id]=(cart[p.id]||0)+1;
  renderCart();
  notifyCartChange();
}

function removeItem(p){
  if(cart[p.id]){
    cart[p.id]--;
    if(cart[p.id]<=0) delete cart[p.id];
    renderCart();
    notifyCartChange();
  }
}

function notifyCartChange(){
  var b=$("topCartBadge");
  b.classList.remove("badge-pop");
  void b.offsetWidth;
  b.classList.add("badge-pop");
}

$("items").addEventListener("click",function(e){
  var b=e.target.closest("button[data-act]");if(!b)return;
  var p=find(b.dataset.id);if(!p)return;
  if(b.dataset.act==="inc")addItem(p);else removeItem(p);
});

function sum(){return Object.keys(cart).reduce(function(s,k){return s+find(k).c*cart[k]},0)}
function countItems(){return Object.keys(cart).reduce(function(s,k){return s+cart[k]},0)}

function renderCart(){
 var ul=$("items");ul.innerHTML="";
 Object.keys(cart).forEach(function(k){
  var p=find(k);var li=document.createElement("li");
  li.innerHTML="<span>"+p.e+" "+p.n+"</span><div class='qty-controls'><button class='qty-btn' data-act='dec' data-id='"+k+"' aria-label='Togli "+p.n+"'>-</button><span>"+cart[k]+"</span><button class='qty-btn' data-act='inc' data-id='"+k+"' aria-label='Aggiungi "+p.n+"'>+</button><span style='min-width:60px;text-align:right;'>"+eur(p.c*cart[k])+"</span></div>";
  ul.appendChild(li);
 });

 var totalStr = eur(sum());
 $("total").textContent=totalStr;
 $("topCartTotal").textContent=totalStr;
 $("topCartBadge").textContent=countItems();
 $("payBtn").disabled=sum()===0;
 if(sum()===0){$("payCard").classList.add("hidden")}
 renderPay();
}

function renderPay(){
 var t=sum();$("given").textContent="Dato: "+eur(given);
 var d=given-t,ch=$("change");
 if(given===0){ch.textContent=""}else if(d<0){ch.textContent="Mancano "+eur(-d)}else{ch.textContent="Resto: "+eur(d)}
 $("doneBtn").disabled=!(t>0&&given>=t);
}

var NOTES=[1,2,5,10,20,50,100];
NOTES.forEach(function(n){var b=document.createElement("button");b.className="btn";b.textContent=n+" €";
 b.onclick=function(){given+=n*100;renderPay()};$("notes").appendChild(b)});
var cents=[10,20,50];
cents.forEach(function(n){var b=document.createElement("button");b.className="btn sun";b.textContent=n+" cent";
 b.onclick=function(){given+=n;renderPay()};$("notes").appendChild(b)});

// Drawer controls
function toggleDrawer(open){
  $("cartDrawer").classList.toggle("open",open);
  $("drawerOverlay").classList.toggle("open",open);
}
$("topCartBar").onclick=function(){toggleDrawer(true)};
$("closeDrawer").onclick=function(){toggleDrawer(false)};
$("drawerOverlay").onclick=function(){toggleDrawer(false)};

$("payBtn").onclick=function(){$("payCard").classList.remove("hidden");$("payCard").scrollIntoView({behavior:"smooth"})};
$("resetGiven").onclick=function(){given=0;renderPay()};
$("clearBtn").onclick=function(){cart={};given=0;renderCart();notifyCartChange();};
$("doneBtn").onclick=function(){cart={};given=0;renderCart();notifyCartChange();toggleDrawer(false);$("scanStatus").textContent="Grazie e arrivederci! Prossimo cliente."};

document.addEventListener("keydown",function(e){
  if(e.key!=="Escape")return;
  toggleDrawer(false);toggleCatModal(false);
});

// Category Modal controls
function toggleCatModal(open){
  $("catModal").classList.toggle("open",open);
}
$("catMenuBtn").onclick=function(){toggleCatModal(true)};
$("closeCatModal").onclick=function(){toggleCatModal(false)};
$("catModal").onclick=function(e){if(e.target===$("catModal"))toggleCatModal(false)};

function buildModalChips(){
  var el=$("modalChips");el.innerHTML="";
  CATS.forEach(function(c){
    var b=document.createElement("button");b.className="chip";
    b.setAttribute("aria-pressed",cat===c.k?"true":"false");
    b.textContent=c.e+" "+c.n;
    b.onclick=function(){
      cat=c.k;
      $("activeCatLabel").textContent=c.n;
      buildModalChips();
      buildGrid($("shopGrid"),addItem);
      buildQr();
      toggleCatModal(false);
    };
    el.appendChild(b);
  });
}

// Tabs
function showTab(t){
 if(t!=="shop")stopCam();
 $("shop").classList.toggle("hidden",t!=="shop");$("qr").classList.toggle("hidden",t!=="qr");
 $("tabShop").setAttribute("aria-pressed",t==="shop");$("tabQr").setAttribute("aria-pressed",t==="qr");
}
$("tabShop").onclick=function(){showTab("shop")};
$("tabQr").onclick=function(){showTab("qr")};
$("printBtn").onclick=function(){window.print()};

// QR scanner
var camStream=null,camOn=false,lastQR="",lastT=0;
function stopCam(){camOn=false;if(camStream){camStream.getTracks().forEach(function(t){t.stop()});camStream=null}$("cam").classList.add("hidden");$("qrBtn").textContent="Fotocamera QR"}
$("qrBtn").onclick=async function(){
 if(camOn){stopCam();$("scanStatus").textContent="Fotocamera spenta.";return}
 if(!navigator.mediaDevices){$("scanStatus").textContent="Questo browser non permette la fotocamera qui.";return}
 if(!window.jsQR&&!window.BarcodeDetector){$("scanStatus").textContent="Lettore QR non caricato.";return}
 try{
  camStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:"environment"},audio:false});
  var v=$("cam");v.srcObject=camStream;v.classList.remove("hidden");await v.play();camOn=true;
  $("qrBtn").textContent="Spegni fotocamera";$("scanStatus").textContent="Fotocamera attiva: inquadra il QR del prodotto.";
  requestAnimationFrame(tick);
 }catch(e){stopCam();$("scanStatus").textContent="Non riesco ad aprire la fotocamera: controlla il permesso."}
};
async function tick(){
 if(!camOn)return;var v=$("cam"),data=null;
 if(v.readyState===v.HAVE_ENOUGH_DATA){
  try{
   if(window.jsQR){var c=$("cv"),x=c.getContext("2d",{willReadFrequently:true});c.width=v.videoWidth;c.height=v.videoHeight;x.drawImage(v,0,0);var q=jsQR(x.getImageData(0,0,c.width,c.height).data,c.width,c.height);data=q?q.data:null}
   else if(window.BarcodeDetector){var r=await new BarcodeDetector({formats:["qr_code"]}).detect(v);data=r.length?r[0].rawValue:null}
  }catch(e){}
  if(data&&data.indexOf(PREFIX)===0&&(data!==lastQR||Date.now()-lastT>1500)){
   var p=find(data.slice(PREFIX.length));lastQR=data;lastT=Date.now();
   if(p){addItem(p);$("scanStatus").textContent="Bip! "+p.e+" "+p.n+" aggiunto.";if(navigator.vibrate)navigator.vibrate(60)}
  }
 }
 requestAnimationFrame(tick);
}

// QR sheet
function buildQr(){
 var g=$("qrGrid");g.innerHTML="";
 if(!window.qrcode){g.textContent="Generatore QR non disponibile.";return}
 PRODUCTS.filter(function(p){return cat==="tutti"||p.cat===cat}).forEach(function(p){
  var q=qrcode(0,"M");q.addData(PREFIX+p.id);q.make();
  var d=document.createElement("div");d.className="qrc";
  d.innerHTML=q.createSvgTag(4,2)+'<div style="font-size:30px">'+p.e+'</div><div><b>'+p.n+'</b> · '+eur(p.c)+'</div>';g.appendChild(d)});
}

buildModalChips();
buildGrid($("shopGrid"),addItem);
buildQr();
renderCart();

// Service worker: rende l'app utilizzabile offline e installabile
if("serviceWorker" in navigator){
  window.addEventListener("load",function(){
    navigator.serviceWorker.register("./sw.js").catch(function(){});
  });
}
