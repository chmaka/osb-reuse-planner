import Dexie, { type EntityTable } from 'dexie';
import type { Remnant, ImageAsset, Part, AuditEvent, ScanRecord, PhotoSource } from './types';
export const db = new Dexie('meditera-osb-reuse-lab') as Dexie & {
  remnants: EntityTable<Remnant,'id'>;
  images: EntityTable<ImageAsset,'id'>;
  parts: EntityTable<Part,'id'>;
  audit: EntityTable<AuditEvent,'id'>;
  scans: EntityTable<ScanRecord,'id'>;
};
db.version(1).stores({
  remnants: 'id, material, thicknessMm, location, status, createdAt',
  images: 'id, createdAt',
  parts: 'id, material, thicknessMm',
  audit: 'id, at, entityId'
});
db.version(2).stores({
  remnants: 'id, material, thicknessMm, location, status, createdAt',
  images: 'id, createdAt',
  parts: 'id, material, thicknessMm',
  audit: 'id, at, entityId',
  scans: 'id, status, createdAt, imageId'
});
export async function storeCapturedPhoto(original:Blob, normalized:Blob, meta:{
  source:PhotoSource; width:number; height:number;
  qualityWarnings:string[];conversion:'native'|'heic-converted';originalName?:string;
}):Promise<{id:string;imageId:string}>{
  const id=crypto.randomUUID(),imageId=crypto.randomUUID(),createdAt=new Date().toISOString();
  await db.transaction('rw',db.scans,db.images,db.audit,async()=>{
    await db.images.add({id:imageId,blob:original,normalizedBlob:normalized,
      mime:original.type||'application/octet-stream',createdAt});
    await db.scans.add({id,imageId,status:'CAPTURED',...meta,
      originalMime:original.type||'application/octet-stream',createdAt});
    await db.audit.add({id:crypto.randomUUID(),at:createdAt,action:'PHOTO_CAPTURED',
      entityId:id,detail:meta.source+' '+meta.width+'x'+meta.height});
  });
  return {id,imageId};
}
export async function storeScan(remnant: Remnant, image?: Blob): Promise<void> {
  await db.transaction('rw',db.remnants,db.images,db.audit,db.scans,async()=>{
    if(remnant.imageId && image) await db.images.put({
      id:remnant.imageId,blob:image,mime:image.type,createdAt:new Date().toISOString()
    });
    await db.remnants.add(remnant);
    if(remnant.scanId){
      const updated=await db.scans.update(remnant.scanId,{status:'MEASURED',remnantId:remnant.id});
      if(!updated)throw Error('Nije pronađen izvorni zapis skeniranja.');
    }
    await db.audit.add({id:crypto.randomUUID(),at:new Date().toISOString(),
      action:'SCAN_MEASURED',entityId:remnant.id,detail:'Manual two-point scale; awaiting verification'});
  });
}