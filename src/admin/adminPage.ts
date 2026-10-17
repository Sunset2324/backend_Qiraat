// Halaman admin satu-berkas (HTML + CSS + JS) untuk mengisi iklan Jurnal Kesehatan.
// Catatan: jangan pakai backtick atau ${ di dalam string ini.
export const adminPageHtml = String.raw`<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Admin Iklan Jurnal Kesehatan</title>
<style>
:root{--bg:#fbf8ef;--card:#fffcf5;--ink:#2b2a26;--mute:#6b6558;--line:#dccb9c;--em:#047857;--em2:#065f46;--gold:#7a6132;--bad:#b91c1c;--ok:#047857}
@media (prefers-color-scheme:dark){:root{--bg:#0f1a17;--card:#16231f;--ink:#ecece6;--mute:#9ca3af;--line:#2c3d37;--em:#34d399;--em2:#10b981;--gold:#e5c77a;--bad:#f87171;--ok:#34d399}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
main{max-width:980px;margin:0 auto;padding:20px 16px 80px}
h1{font-size:22px;margin:0 0 4px;color:var(--gold)} h2{font-size:17px;margin:0 0 12px}
p.sub{margin:0 0 20px;color:var(--mute);font-size:14px}
.card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:16px;margin-bottom:16px}
label{display:block;font-weight:600;font-size:14px;margin:12px 0 4px}
.hint{font-weight:400;color:var(--mute);font-size:12px}
input[type=text],input[type=url],input[type=password],input[type=number],textarea{width:100%;padding:10px 12px;border:1px solid var(--line);border-radius:10px;background:var(--bg);color:var(--ink);font:inherit}
textarea{min-height:76px;resize:vertical}
input:focus,textarea:focus,button:focus-visible,select:focus{outline:2px solid var(--em);outline-offset:1px}
.row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
@media (max-width:640px){.row{grid-template-columns:1fr}}
button{font:inherit;cursor:pointer;border-radius:10px;padding:10px 16px;border:1px solid var(--line);background:var(--card);color:var(--ink)}
button.primary{background:var(--em2);border-color:var(--em2);color:#fff;font-weight:700}
button.danger{color:var(--bad)}
button:disabled{opacity:.5;cursor:not-allowed}
.ratio{position:relative;width:100%;aspect-ratio:16/9;background:repeating-conic-gradient(#0001 0 25%,#0000 0 50%) 0 0/20px 20px;border:1px dashed var(--line);border-radius:12px;overflow:hidden;display:flex;align-items:center;justify-content:center;color:var(--mute);font-size:13px}
.ratio img,.ratio canvas{width:100%;height:100%;object-fit:cover;display:block}
.msg{margin-top:10px;font-size:14px;min-height:20px}.msg.bad{color:var(--bad)}.msg.ok{color:var(--ok)}
.seg{display:flex;gap:8px;flex-wrap:wrap}.seg label{display:flex;align-items:center;gap:6px;margin:0;font-weight:500;padding:8px 12px;border:1px solid var(--line);border-radius:10px}
.seg input{margin:0}
.res{max-height:220px;overflow:auto;border:1px solid var(--line);border-radius:10px;margin-top:6px;display:none}
.res button{display:block;width:100%;text-align:left;border:0;border-bottom:1px solid var(--line);border-radius:0;background:transparent;padding:8px 12px;font-size:14px}
.res button small{color:var(--mute)}
.quote{margin-top:10px;padding:12px;border:1px solid var(--line);border-radius:12px;background:var(--bg)}
.quote .ar{font-family:"Amiri Quran","Traditional Arabic",serif;font-size:24px;line-height:2;text-align:right;direction:rtl}
.quote .id{font-size:13px;color:var(--mute)}
.list{display:grid;gap:12px}
.item{display:grid;grid-template-columns:200px 1fr;gap:12px;border:1px solid var(--line);border-radius:14px;padding:10px;background:var(--bg)}
@media (max-width:640px){.item{grid-template-columns:1fr}}
.item .ratio{border-radius:8px}
.badge{display:inline-block;font-size:11px;padding:2px 8px;border-radius:99px;border:1px solid var(--line);color:var(--mute);margin-right:6px}
.badge.on{color:var(--ok);border-color:var(--ok)}
.actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
.actions button{padding:6px 12px;font-size:13px}
.hidden{display:none!important}
.rule{font-size:13px;color:var(--mute);background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:8px 12px;margin-top:6px}
</style>
</head>
<body>
<main>
  <h1>Admin Iklan Jurnal Kesehatan</h1>
  <p class="sub">Iklan produk (rasio 16:9) dengan kutipan ayat dari Thibbun Nabawi. Iklan aktif tampil di app pada layar Jurnal Kesehatan.</p>

  <section class="card" id="loginCard">
    <h2>Masuk</h2>
    <label for="key">Kunci admin</label>
    <input id="key" type="password" autocomplete="current-password" placeholder="ADMIN_KEY dari environment Vercel">
    <div style="margin-top:12px"><button class="primary" id="loginBtn">Masuk</button></div>
    <div class="msg" id="loginMsg" role="alert"></div>
  </section>

  <div id="app" class="hidden">
    <section class="card">
      <h2 id="formTitle">Tambah iklan</h2>
      <form id="f" novalidate>
        <input type="hidden" id="editId">
        <label for="title">Judul / nama produk <span class="hint">(maks 80)</span></label>
        <input id="title" type="text" maxlength="80" required>
        <label for="desc">Deskripsi singkat <span class="hint">(maks 220, opsional)</span></label>
        <textarea id="desc" maxlength="220"></textarea>

        <label for="tq">Kutipan ayat dari Thibbun Nabawi</label>
        <input id="tq" type="text" placeholder="Cari tema (mis. madu, puasa) atau referensi surah:ayat (mis. 16:69)" autocomplete="off">
        <div class="res" id="res"></div>
        <div id="chosen" class="hint" style="margin-top:6px">Belum ada ayat dipilih.</div>
        <div class="quote hidden" id="quote"><div class="ar" id="qAr"></div><div class="id" id="qId"></div></div>

        <label>Gambar iklan</label>
        <div class="rule" id="rule"></div>
        <div class="seg" style="margin-top:8px">
          <label><input type="radio" name="mode" value="upload" id="mUpload"> Upload (Cloudinary)</label>
          <label><input type="radio" name="mode" value="url" id="mUrl"> Tempel URL gambar</label>
        </div>
        <div id="upBox" style="margin-top:10px">
          <input id="file" type="file" accept="image/jpeg,image/png,image/webp">
          <div class="row" style="margin-top:8px">
            <div><label for="fx" style="margin-top:0">Fokus horizontal <span class="hint">(geser bila terpotong)</span></label><input id="fx" type="range" min="0" max="100" value="50" style="width:100%"></div>
            <div><label for="fy" style="margin-top:0">Fokus vertikal</label><input id="fy" type="range" min="0" max="100" value="50" style="width:100%"></div>
          </div>
        </div>
        <div id="urlBox" class="hidden" style="margin-top:10px">
          <input id="imgUrl" type="url" placeholder="https://.../gambar.jpg">
        </div>
        <div class="ratio" id="prev" style="margin-top:10px"><span>Pratinjau 16:9</span></div>
        <div class="msg" id="imgMsg"></div>

        <label for="prod">Link produk <span class="hint">(https)</span></label>
        <input id="prod" type="url" placeholder="https://...">
        <div class="row">
          <div><label for="cta">Label tombol <span class="hint">(maks 24)</span></label><input id="cta" type="text" maxlength="24" value="Lihat Produk"></div>
          <div><label for="ord">Urutan <span class="hint">(kecil tampil dulu)</span></label><input id="ord" type="number" value="0"></div>
        </div>
        <label style="display:flex;gap:8px;align-items:center;font-weight:500"><input id="act" type="checkbox" checked> Aktif (tampil di app)</label>

        <div class="actions" style="margin-top:16px">
          <button class="primary" id="saveBtn" type="submit">Simpan iklan</button>
          <button type="button" id="resetBtn">Reset form</button>
        </div>
        <div class="msg" id="msg" role="alert"></div>
      </form>
    </section>

    <section class="card">
      <h2>Daftar iklan <span class="hint" id="storeInfo"></span></h2>
      <div class="list" id="list"></div>
    </section>
  </div>
</main>

<script>
(function(){
  var $=function(id){return document.getElementById(id)};
  var KEY="", cfg=null, ads=[];
  var sel={tema:"",surah:0,ayat:0};
  var img={url:"",w:0,h:0,blob:null,src:null}; // gambar terpilih
  function esc(s){var d=document.createElement("div");d.textContent=s==null?"":String(s);return d.innerHTML}
  function say(el,t,cls){el.textContent=t||"";el.className="msg"+(cls?" "+cls:"")}

  function api(path,opt){
    opt=opt||{};opt.headers=Object.assign({"x-admin-key":KEY,"Content-Type":"application/json"},opt.headers||{});
    return fetch("/admin/api"+path,opt).then(function(r){return r.json().catch(function(){return{}}).then(function(j){
      if(!r.ok||j.success===false){throw new Error(j.message||("Gagal ("+r.status+")"))}return j})})
  }

  // ---- Login
  function login(){
    KEY=$("key").value.trim(); if(!KEY){say($("loginMsg"),"Isi kunci admin.","bad");return}
    say($("loginMsg"),"Memeriksa...");
    api("/config").then(function(j){
      cfg=j.data;try{sessionStorage.setItem("adminKey",KEY)}catch(e){}
      $("loginCard").classList.add("hidden");$("app").classList.remove("hidden");init();
    }).catch(function(e){say($("loginMsg"),e.message,"bad")});
  }
  $("loginBtn").onclick=login;
  $("key").addEventListener("keydown",function(e){if(e.key==="Enter")login()});
  try{var k=sessionStorage.getItem("adminKey");if(k){$("key").value=k;login()}}catch(e){}

  function init(){
    var r=cfg.rule;
    $("rule").textContent="Rasio "+r.ratioW+":"+r.ratioH+". Upload otomatis dipotong dan diubah ke "+r.uploadWidth+"x"+r.uploadHeight+"px (maks "+Math.round(r.maxBytes/1024)+" KB). URL gambar: rasio 16:9 dan lebar minimal "+r.minWidth+"px.";
    $("storeInfo").textContent="(penyimpanan: "+(cfg.store==="upstash"?"Upstash":"memori sementara - hanya uji lokal")+")";
    if(!cfg.cloudinary){$("mUpload").disabled=true;$("mUrl").checked=true;setMode("url");$("rule").textContent+=" Upload dinonaktifkan: Cloudinary belum dikonfigurasi."}
    else{$("mUpload").checked=true;setMode("upload")}
    loadAds();
  }

  // ---- Tema Thibbun
  function renderRes(q){
    var box=$("res");q=q.trim().toLowerCase();
    if(!q){box.style.display="none";return}
    var m=/^(\d{1,3})\s*[:.]\s*(\d{1,3})$/.exec(q),out=[];
    for(var i=0;i<cfg.tema.length&&out.length<30;i++){
      var t=cfg.tema[i];
      if(m?(t.s===+m[1]&&t.a===+m[2]):t.tema.toLowerCase().indexOf(q)>=0)out.push(t);
    }
    box.innerHTML="";
    if(!out.length){box.style.display="block";box.innerHTML='<div style="padding:10px" class="hint">Tidak ada hasil.</div>';return}
    out.forEach(function(t){
      var b=document.createElement("button");b.type="button";
      b.innerHTML=esc(t.tema)+" <small>QS "+t.s+":"+t.a+" - "+esc(t.k)+"</small>";
      b.onclick=function(){pick(t.tema,t.s,t.a)};box.appendChild(b);
    });
    box.style.display="block";
  }
  $("tq").addEventListener("input",function(){renderRes(this.value)});
  function pick(tema,s,a){
    sel={tema:tema,surah:s,ayat:a};$("res").style.display="none";$("tq").value="";
    $("chosen").textContent="Dipilih: "+tema+" (QS "+s+":"+a+")";
    $("quote").classList.remove("hidden");$("qAr").textContent="Memuat ayat...";$("qId").textContent="";
    fetch("/api/surat/"+s+"?qari=05").then(function(r){return r.json()}).then(function(j){
      var d=j.data||{},list=d.ayat||[],x=null;
      for(var i=0;i<list.length;i++){if(+list[i].nomor===a){x=list[i];break}}
      if(!x)throw new Error("x");
      $("qAr").textContent=x.teksArab;$("qId").textContent=x.teksIndonesia||x.artiIndonesia||"";
    }).catch(function(){$("qAr").textContent="";$("qId").textContent="Pratinjau ayat gagal dimuat (referensi tetap tersimpan)."});
  }

  // ---- Gambar
  function mode(){return $("mUpload").checked?"upload":"url"}
  function setMode(m){
    $("upBox").classList.toggle("hidden",m!=="upload");$("urlBox").classList.toggle("hidden",m!=="url");
    img={url:img.url&&m==="url"?img.url:"",w:0,h:0,blob:null,src:null};showPrev(null);say($("imgMsg"),"");
    if(m==="url"&&$("imgUrl").value)checkUrl();
  }
  $("mUpload").onchange=function(){setMode("upload")};$("mUrl").onchange=function(){setMode("url")};
  function showPrev(node){var p=$("prev");p.innerHTML="";if(node)p.appendChild(node);else p.innerHTML="<span>Pratinjau 16:9</span>"}

  function drawCover(){
    var r=cfg.rule,c=document.createElement("canvas");c.width=r.uploadWidth;c.height=r.uploadHeight;
    var ctx=c.getContext("2d"),s=img.src,sw=s.naturalWidth,sh=s.naturalHeight;
    var target=r.ratioW/r.ratioH,cw,ch;
    if(sw/sh>target){ch=sh;cw=sh*target}else{cw=sw;ch=sw/target}
    var sx=(sw-cw)*($("fx").value/100),sy=(sh-ch)*($("fy").value/100);
    ctx.drawImage(s,sx,sy,cw,ch,0,0,c.width,c.height);return c;
  }
  function encode(c){
    var max=cfg.rule.maxBytes,qs=[0.9,0.82,0.74,0.66,0.58,0.5,0.42];
    return new Promise(function(res,rej){
      (function t(i){c.toBlob(function(b){
        if(!b)return rej(new Error("Gagal mengkompres gambar."));
        if(b.size<=max||i>=qs.length-1){b.size<=max?res(b):rej(new Error("Gambar terlalu detail: tetap di atas "+Math.round(max/1024)+" KB. Pakai gambar yang lebih sederhana."))}
        else t(i+1)},"image/jpeg",qs[i])})(0);
    });
  }
  function refreshUpload(){
    if(!img.src)return;var c=drawCover();showPrev(c);
    encode(c).then(function(b){
      img.blob=b;img.w=cfg.rule.uploadWidth;img.h=cfg.rule.uploadHeight;
      say($("imgMsg"),"Siap: "+img.w+"x"+img.h+"px, "+Math.round(b.size/1024)+" KB.","ok");
    }).catch(function(e){img.blob=null;say($("imgMsg"),e.message,"bad")});
  }
  $("file").onchange=function(){
    var f=this.files[0];if(!f)return;
    if(!/^image\/(jpeg|png|webp)$/.test(f.type)){say($("imgMsg"),"Format harus JPG, PNG, atau WebP.","bad");return}
    var u=URL.createObjectURL(f),i=new Image();
    i.onload=function(){
      if(i.naturalWidth<cfg.rule.uploadWidth||i.naturalHeight<cfg.rule.uploadHeight){
        say($("imgMsg"),"Gambar terlalu kecil ("+i.naturalWidth+"x"+i.naturalHeight+"). Minimal "+cfg.rule.uploadWidth+"x"+cfg.rule.uploadHeight+"px.","bad");img.src=null;img.blob=null;return}
      img.src=i;refreshUpload();
    };i.onerror=function(){say($("imgMsg"),"File gambar tidak bisa dibaca.","bad")};i.src=u;
  };
  $("fx").oninput=refreshUpload;$("fy").oninput=refreshUpload;

  function checkUrl(){
    var u=$("imgUrl").value.trim();img.url="";img.w=0;img.h=0;
    if(!u){showPrev(null);say($("imgMsg"),"");return}
    if(!/^https:\/\//i.test(u)){say($("imgMsg"),"URL gambar harus diawali https://","bad");return}
    say($("imgMsg"),"Memeriksa gambar...");
    var i=new Image();i.referrerPolicy="no-referrer";
    i.onload=function(){
      var w=i.naturalWidth,h=i.naturalHeight,r=cfg.rule;showPrev(i);
      if(Math.abs(w/h-r.ratioW/r.ratioH)>0.03){say($("imgMsg"),"Rasio "+w+"x"+h+" bukan 16:9.","bad");return}
      if(w<r.minWidth){say($("imgMsg"),"Lebar "+w+"px kurang dari "+r.minWidth+"px.","bad");return}
      img.url=u;img.w=w;img.h=h;say($("imgMsg"),"Valid: "+w+"x"+h+"px (16:9).","ok");
    };
    i.onerror=function(){say($("imgMsg"),"Gambar tidak bisa dimuat dari URL itu.","bad")};i.src=u;
  }
  $("imgUrl").addEventListener("change",checkUrl);$("imgUrl").addEventListener("blur",checkUrl);

  function uploadCloudinary(blob){
    return api("/cloudinary-sign",{method:"POST",body:"{}"}).then(function(j){
      var s=j.data,fd=new FormData();
      fd.append("file",blob,"iklan.jpg");fd.append("api_key",s.apiKey);fd.append("timestamp",s.timestamp);
      fd.append("folder",s.folder);fd.append("signature",s.signature);
      return fetch("https://api.cloudinary.com/v1_1/"+s.cloudName+"/image/upload",{method:"POST",body:fd})
        .then(function(r){return r.json()}).then(function(u){
          if(!u.secure_url)throw new Error((u.error&&u.error.message)||"Upload Cloudinary gagal.");return u.secure_url});
    });
  }

  // ---- Simpan
  function validate(){
    if(!$("title").value.trim())return "Judul wajib diisi.";
    if(!sel.surah)return "Pilih ayat dari tema Thibbun Nabawi.";
    if(!/^https:\/\//i.test($("prod").value.trim()))return "Link produk harus diawali https://";
    if(mode()==="upload"&&!img.blob&&!img.url)return "Pilih gambar yang valid.";
    if(mode()==="url"&&!img.url)return "URL gambar belum valid.";
    return "";
  }
  $("f").addEventListener("submit",function(e){
    e.preventDefault();var err=validate();if(err){say($("msg"),err,"bad");return}
    $("saveBtn").disabled=true;say($("msg"),"Menyimpan...");
    var up=(mode()==="upload"&&img.blob)?uploadCloudinary(img.blob).then(function(u){img.url=u;return u}):Promise.resolve(img.url);
    up.then(function(url){
      var body={title:$("title").value.trim(),description:$("desc").value.trim(),ctaLabel:$("cta").value.trim(),
        tema:sel.tema,surah:sel.surah,ayat:sel.ayat,imageUrl:url,imageWidth:img.w,imageHeight:img.h,
        productUrl:$("prod").value.trim(),active:$("act").checked,order:+$("ord").value||0};
      var id=$("editId").value;
      return api(id?"/ads/"+id:"/ads",{method:id?"PUT":"POST",body:JSON.stringify(body)});
    }).then(function(){say($("msg"),"Tersimpan.","ok");resetForm(true);loadAds()})
    .catch(function(e){say($("msg"),e.message,"bad")})
    .then(function(){$("saveBtn").disabled=false});
  });
  function resetForm(keepMsg){
    $("f").reset();$("editId").value="";$("formTitle").textContent="Tambah iklan";$("cta").value="Lihat Produk";$("act").checked=true;
    sel={tema:"",surah:0,ayat:0};$("chosen").textContent="Belum ada ayat dipilih.";$("quote").classList.add("hidden");$("res").style.display="none";
    img={url:"",w:0,h:0,blob:null,src:null};showPrev(null);say($("imgMsg"),"");if(!keepMsg)say($("msg"),"");
    if(cfg.cloudinary){$("mUpload").checked=true;setMode("upload")}else{$("mUrl").checked=true;setMode("url")}
  }
  $("resetBtn").onclick=function(){resetForm(false)};

  // ---- Daftar
  function loadAds(){
    api("/ads").then(function(j){ads=j.data||[];renderList()}).catch(function(e){$("list").textContent=e.message});
  }
  function renderList(){
    var box=$("list");box.innerHTML="";
    if(!ads.length){box.innerHTML='<div class="hint">Belum ada iklan.</div>';return}
    ads.forEach(function(a){
      var d=document.createElement("div");d.className="item";
      d.innerHTML='<div class="ratio"><img alt="" referrerpolicy="no-referrer" src="'+esc(a.imageUrl)+'"></div><div>'
        +'<div><span class="badge '+(a.active?"on":"")+'">'+(a.active?"Aktif":"Nonaktif")+'</span><span class="badge">urutan '+esc(a.order)+'</span></div>'
        +'<strong>'+esc(a.title)+'</strong><div class="hint">'+esc(a.tema)+' - QS '+a.surah+':'+a.ayat+'</div>'
        +'<div class="hint"><a href="'+esc(a.productUrl)+'" target="_blank" rel="noopener noreferrer">'+esc(a.productUrl)+'</a></div>'
        +'<div class="actions"></div></div>';
      var act=d.querySelector(".actions");
      function btn(t,fn,cls){var b=document.createElement("button");b.type="button";b.textContent=t;if(cls)b.className=cls;b.onclick=fn;act.appendChild(b)}
      btn("Edit",function(){edit(a)});
      btn(a.active?"Nonaktifkan":"Aktifkan",function(){toggle(a)});
      btn("Hapus",function(){if(confirm("Hapus iklan ini?"))api("/ads/"+a.id,{method:"DELETE"}).then(loadAds).catch(function(e){alert(e.message)})},"danger");
      box.appendChild(d);
    });
  }
  function payload(a,over){
    var b={title:a.title,description:a.description,ctaLabel:a.ctaLabel,tema:a.tema,surah:a.surah,ayat:a.ayat,imageUrl:a.imageUrl,
      imageWidth:a.imageWidth,imageHeight:a.imageHeight,productUrl:a.productUrl,active:a.active,order:a.order};
    for(var k in over)b[k]=over[k];return JSON.stringify(b);
  }
  function toggle(a){api("/ads/"+a.id,{method:"PUT",body:payload(a,{active:!a.active})}).then(loadAds).catch(function(e){alert(e.message)})}
  function edit(a){
    resetForm(false);$("editId").value=a.id;$("formTitle").textContent="Edit iklan";
    $("title").value=a.title;$("desc").value=a.description||"";$("prod").value=a.productUrl;$("cta").value=a.ctaLabel;$("ord").value=a.order;$("act").checked=a.active;
    pick(a.tema,a.surah,a.ayat);
    $("mUrl").checked=true;setMode("url");$("imgUrl").value=a.imageUrl;
    img={url:a.imageUrl,w:a.imageWidth,h:a.imageHeight,blob:null,src:null};
    var i=new Image();i.referrerPolicy="no-referrer";i.src=a.imageUrl;showPrev(i);
    say($("imgMsg"),"Gambar lama dipakai. Pilih Upload atau ganti URL untuk mengubahnya.");
    window.scrollTo({top:0,behavior:"smooth"});
  }
})();
</script>
</body>
</html>`;
