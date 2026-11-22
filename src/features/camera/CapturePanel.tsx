import { useEffect, useRef, useState } from 'react';
import { Camera, RefreshCcw, Upload, Lightbulb, Focus, X, Video, ImagePlus } from 'lucide-react';

export type PhotoSource='camera'|'upload';
interface Props { onCapture:(file:Blob,source:PhotoSource)=>Promise<void>; onError:(message:string)=>void }
type CameraCapabilities=MediaTrackCapabilities & {
  torch?:boolean;focusMode?:string[];
  exposureCompensation?:{min:number;max:number;step:number};
};
type CaptureConstructor=new(track:MediaStreamTrack)=>{takePhoto:()=>Promise<Blob>};
function cameraMessage(error:unknown):string{
  const name=(error as {name?:string})?.name;
  if(name==='NotAllowedError'||name==='PermissionDeniedError')
    return 'Kamera je odbijena. Dozvoli pristup u podešavanjima browsera ili učitaj fotografiju.';
  if(name==='NotFoundError'||name==='DevicesNotFoundError')
    return 'Na ovom uređaju nije pronađena kamera. Koristi učitavanje slike.';
  if(name==='NotReadableError'||name==='TrackStartError')
    return 'Kamera je zauzeta ili je uređaj blokirao pristup. Zatvori druge aplikacije.';
  if(name==='OverconstrainedError')
    return 'Odabrana kamera ili njena rezolucija nije dostupna. Izaberi drugu kameru.';
  return 'Kamera nije dostupna ('+String(error)+'). Možeš učitati postojeću fotografiju.';
}
export default function CapturePanel({onCapture,onError}:Props){
  const [active,setActive]=useState(false);
  const [devices,setDevices]=useState<MediaDeviceInfo[]>([]);
  const [selected,setSelected]=useState('');
  const [busy,setBusy]=useState(false);
  const [torchSupported,setTorchSupported]=useState(false);
  const [torch,setTorch]=useState(false);
  const [focusSupported,setFocusSupported]=useState(false);
  const [exposure,setExposure]=useState<{min:number;max:number;step:number;value:number}|null>(null);
  const videoRef=useRef<HTMLVideoElement>(null),fileRef=useRef<HTMLInputElement>(null);
  const streamRef=useRef<MediaStream|null>(null),mounted=useRef(true),generation=useRef(0);
  function stop(){
    generation.current++;
    streamRef.current?.getTracks().forEach(t=>t.stop());
    streamRef.current=null;
    if(videoRef.current)videoRef.current.srcObject=null;
    setActive(false);setTorch(false);setTorchSupported(false);setFocusSupported(false);setExposure(null);
  }
  useEffect(()=>{mounted.current=true;return ()=>{mounted.current=false;generation.current++;streamRef.current?.getTracks().forEach(t=>t.stop())}},[]);
  async function open(deviceId?:string){
    if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia){
      onError('Kamera zahtijeva HTTPS ili localhost i browser koji podržava MediaDevices. Učitaj sliku.');
      return;
    }
    stop();
    const call=++generation.current;
    setBusy(true);
    try{
      const video:MediaTrackConstraints=deviceId?{deviceId:{exact:deviceId}}:
        {facingMode:{ideal:'environment'},width:{ideal:2560},height:{ideal:1440}};
      const stream=await navigator.mediaDevices.getUserMedia({audio:false,video});
      if(!mounted.current||call!==generation.current){stream.getTracks().forEach(t=>t.stop());return}
      streamRef.current=stream;
      const track=stream.getVideoTracks()[0];
      if(!track)throw Error('Nema aktivnog video kanala.');
      const caps=(track.getCapabilities?.()||{}) as CameraCapabilities;
      setTorchSupported(!!caps.torch);
      setFocusSupported(!!caps.focusMode?.includes('continuous'));
      const exp=caps.exposureCompensation;
      setExposure(exp&&Number.isFinite(exp.min)&&Number.isFinite(exp.max)?{
        min:exp.min,max:exp.max,step:exp.step||1,value:0
      }:null);
      setActive(true);
      if(videoRef.current){
        videoRef.current.srcObject=stream;
        await videoRef.current.play().catch(()=>onError('Pregled kamere nije pokrenut automatski. Provjeri dozvole.'));
      }
      const all=await navigator.mediaDevices.enumerateDevices();
      if(mounted.current&&call===generation.current){
        const cameras=all.filter(d=>d.kind==='videoinput');
        setDevices(cameras);
        setSelected(track.getSettings().deviceId||deviceId||cameras[0]?.deviceId||'');
      }
    }catch(error){
      if(call===generation.current){stop();onError(cameraMessage(error))}
    }finally{if(mounted.current&&call===generation.current)setBusy(false);else setBusy(false)}
  }
  async function applyAdvanced(values:Record<string,unknown>){
    const track=streamRef.current?.getVideoTracks()[0];
    if(!track)return;
    try{await track.applyConstraints({advanced:[values as MediaTrackConstraintSet]})}
    catch(e){onError('Uređaj ne podržava traženo podešavanje: '+String(e))}
  }
  async function toggleTorch(){
    await applyAdvanced({torch:!torch});setTorch(v=>!v);
  }
  async function capture(){
    const video=videoRef.current,track=streamRef.current?.getVideoTracks()[0];
    if(!video||!track){onError('Kamera još nije spremna.');return}
    setBusy(true);
    try{
      let blob:Blob|null=null;
      const ImageCaptureClass=(window as Window&{ImageCapture?:CaptureConstructor}).ImageCapture;
      if(ImageCaptureClass){
        try{blob=await new ImageCaptureClass(track).takePhoto()}
        catch{/* Some drivers expose ImageCapture but fail taking stills. Use canvas. */}
      }
      if(!blob){
        if(video.videoWidth<80||video.videoHeight<80)throw Error('Video kadar nije spreman.');
        const canvas=document.createElement('canvas');
        canvas.width=video.videoWidth;canvas.height=video.videoHeight;
        canvas.getContext('2d')?.drawImage(video,0,0);
        blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):
          reject(Error('Kadar nije sačuvan.')),'image/jpeg',0.94));
      }
      await onCapture(blob,'camera');
      stop();
    }catch(e){onError('Snimanje nije uspjelo: '+String(e))}
    finally{setBusy(false)}
  }
  async function importFile(file?:File){
    if(!file)return;
    setBusy(true);
    try{await onCapture(file,'upload');stop()}
    catch(e){onError('Učitavanje nije uspjelo: '+String(e))}
    finally{setBusy(false)}
  }
  return <div className="capture-widget">
    {!active?<div className="capture-empty">
      <div className="camera-orbit"><Camera size={36}/></div>
      <h3>Dodaj fotografiju OSB ostatka</h3>
      <p>Postavi cijeli ostatak na kontrastnu podlogu; poznata mjera mora biti u istoj ravni sa gornjom površinom materijala.</p>
      <div className="action-row centered">
        <button className="primary" disabled={busy} onClick={()=>void open()}><Camera size={18}/> Otvori kameru</button>
        <button className="secondary" disabled={busy} onClick={()=>fileRef.current?.click()}><Upload size={18}/> Učitaj sliku</button>
      </div>
      {busy&&<p className="small-help" role="status">Obrada fotografije...</p>}
    </div>:<div className="live-camera">
      <video ref={videoRef} autoPlay muted playsInline/>
      <div className="camera-crosshair"/>
      <div className="camera-controls">
        <div className="camera-control-row">
          {devices.length>1&&<label className="camera-select"><Video size={16}/>
            <select aria-label="Izaberi kameru" value={selected} onChange={e=>{setSelected(e.target.value);void open(e.target.value)}}>
              {devices.map((d,i)=><option key={d.deviceId} value={d.deviceId}>{d.label||'Kamera '+(i+1)}</option>)}
            </select></label>}
          {devices.length>1&&<button className="secondary" disabled={busy} onClick={()=>{
            const i=devices.findIndex(d=>d.deviceId===selected);
            void open(devices[(i+1)%devices.length].deviceId)
          }}><RefreshCcw size={16}/> Zamijeni</button>}
          {torchSupported&&<button className="secondary" aria-pressed={torch} onClick={()=>void toggleTorch()}><Lightbulb size={16}/>{torch?'Lampa uključena':'Lampa'}</button>}
          {focusSupported&&<button className="secondary" onClick={()=>void applyAdvanced({focusMode:'continuous'})}><Focus size={16}/> Auto fokus</button>}
        </div>
        {exposure&&<label className="exposure-control">Ekspozicija
          <input aria-label="Ekspozicija" type="range" min={exposure.min} max={exposure.max} step={exposure.step}
            value={exposure.value} onChange={e=>{
              const value=Number(e.target.value);
              setExposure(s=>s?{...s,value}:null);void applyAdvanced({exposureCompensation:value});
            }}/></label>}
        <div className="action-row camera-actions">
          <button className="primary" disabled={busy} onClick={()=>void capture()}><Camera size={18}/> {busy?'Snimanje...':'Fotografiši'}</button>
          <button className="secondary" disabled={busy} onClick={()=>fileRef.current?.click()}><ImagePlus size={17}/> Iz galerije</button>
          <button className="secondary" disabled={busy} onClick={stop}><X size={17}/> Zatvori</button>
        </div>
      </div>
    </div>}
    <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" className="sr-only"
      onChange={e=>{const file=e.target.files?.[0];void importFile(file);e.target.value=''}}/>
  </div>;
}
