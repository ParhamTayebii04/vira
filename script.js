function scrollToId(id){document.getElementById(id).scrollIntoView({behavior:'smooth'})}
var booking={serviceType:null,preferredDate:null,preferredTime:'10:00',clientContact:''};
function selectService(el,val){document.querySelectorAll('.s-card').forEach(c=>c.classList.remove('selected'));el.classList.add('selected');booking.serviceType=val;document.getElementById('err1').innerText='';if(navigator.vibrate)navigator.vibrate(20);}
function goStep(n){
if(n===2&&!booking.serviceType){document.getElementById('err1').innerText='⚠️ لطفا یک خدمت را انتخاب کنید';return;}
if(n===3){
var d=document.getElementById('date').value;var t=document.getElementById('time').value;var p=document.getElementById('phone').value;
if(!d){document.getElementById('err2').innerText='⚠️ تاریخ را انتخاب کنید';return;}
if(!p||p.length<10){document.getElementById('err2').innerText='⚠️ شماره موبایل معتبر وارد کنید (09-...)';return;}
booking.preferredDate=d;booking.preferredTime=t;booking.clientContact=p;
submitBooking();
}
document.querySelectorAll('.wstep').forEach(s=>s.classList.remove('active'));
document.getElementById('step'+n).classList.add('active');
document.querySelectorAll('.dot').forEach((d,i)=>d.classList.toggle('active',i<n));
document.getElementById('progressBar').style.width=(n*33.3)+'%';
}
async function submitBooking(){
document.getElementById('processing').style.display='block';document.getElementById('success').style.display='none';
var payload={serviceType:booking.serviceType,preferredDate:booking.preferredDate,preferredTime:booking.preferredTime,clientContact:booking.clientContact};
console.log('POST /api/services/book',payload);
await new Promise(r=>setTimeout(r,1800));
document.getElementById('processing').style.display='none';document.getElementById('success').style.display='block';
document.getElementById('summary').innerText=booking.serviceType+' | '+booking.preferredDate+' ساعت '+booking.preferredTime;
}
// THREE.JS Hero - Metallic Shaft
let scene=new THREE.Scene();let cam=new THREE.PerspectiveCamera(75,innerWidth/innerHeight,.1,1000);let ren=new THREE.WebGLRenderer({canvas:document.getElementById('elevator3D'),alpha:true});ren.setSize(innerWidth,innerHeight);
let shaft=new THREE.Mesh(new THREE.BoxGeometry(4,12,4),new THREE.MeshStandardMaterial({color:0x222a3a,metalness:.9,roughness:.2,transparent:true,opacity:.25}));
scene.add(shaft);
let cabin=new THREE.Mesh(new THREE.BoxGeometry(2.5,2.5,2.5),new THREE.MeshStandardMaterial({color:0xD4AF37,metalness:1,roughness:.15}));
scene.add(cabin);
let light1=new THREE.PointLight(0x1E90FF,2,30);light1.position.set(5,5,5);scene.add(light1);
let light2=new THREE.PointLight(0xD4AF37,2,30);light2.position.set(-5,-5,5);scene.add(light2);
cam.position.z=14;
let t=0;function anim(){requestAnimationFrame(anim);t+=0.015;cabin.position.y=Math.sin(t)*4;shaft.rotation.y+=0.002;cabin.rotation.y+=0.005;ren.render(scene,cam)}anim();