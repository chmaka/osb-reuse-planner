import Dexie, { type EntityTable } from 'dexie';
import type { Remnant, ImageAsset, Part, AuditEvent, ScanRecord, PhotoSource, ValidationTrial } from './types';
export const db = new Dexie('meditera-osb-reuse-lab') as Dexie & {
  remnants: EntityTable<Remnant,'id'>;
  images: EntityTable<ImageAsset,'id'>;
  parts: EntityTable<Part,'id'>;
  audit: EntityTable<AuditEvent,'id'>;
  scans: EntityTable<ScanRecord,'id'>;
  validation: EntityTable<ValidationTrial,'id'>;
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
db.version(3).stores({
  remnants:'id, material, thicknessMm, location, status, createdAt',
  images:'id, createdAt',
  parts:'id, material, thicknessMm',
  audit:'id, at, entityId',
  scans:'id, status, createdAt, imageId',
  validation:'id, remnantId, at, algorithm'
});
/** Independently measured physical dimensions. Never changes remnant verification status. */
export async function recordValidation(input:{
  remnantId:string;actualWidthMm:number;actualHeightMm:number;toleranceMm:number;
  device:string;lighting:string;referenceMethod:string;notes:string
}):Promise<ValidationTrial>{
  const {predictedBounds,evaluateTrial}=await import('./features/validation/metrics');
  let stored:ValidationTrial|undefined;
  await db.transaction('rw',db.remnants,db.validation,db.audit,async()=>{
    const remnant=await db.remnants.get(input.remnantId);
    if(!remnant)throw Error('Ostatak nije pronađen.');
    const {widthMm,heightMm}=predictedBounds(remnant);
    const trial:ValidationTrial={
      id:crypto.randomUUID(),at:new Date().toISOString(),remnantId:remnant.id,
      remnantLabel:remnant.label,remnantRevision:remnant.revision,
      calibrationMethod:remnant.calibrationMethod,algorithm:remnant.segmentation?.algorithm||'manual',
      predictedWidthMm:widthMm,predictedHeightMm:heightMm,
      actualWidthMm:input.actualWidthMm,actualHeightMm:input.actualHeightMm,
      toleranceMm:input.toleranceMm,
      device:input.device.trim().slice(0,100),lighting:input.lighting.trim().slice(0,100),
      referenceMethod:input.referenceMethod.trim().slice(0,120),
      notes:input.notes.trim().slice(0,1000)
    };
    evaluateTrial(trial);
    if(!trial.referenceMethod)throw Error('Navedi čime su fizičke dimenzije izmjerene.');
    await db.validation.add(trial);
    await db.audit.add({id:crypto.randomUUID(),at:trial.at,action:'PILOT_DIMENSION_CHECK',
      entityId:trial.remnantId,detail:'independent physical width/height evidence added; remnant status unchanged'});
    stored=trial;
  });
  if(!stored)throw Error('Kontrola nije sačuvana.');
  return stored;
}
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
      action:'SCAN_MEASURED',entityId:remnant.id,detail:remnant.calibrationMethod+'; '+(remnant.segmentation?.algorithm||'manual trace')+'; '+remnant.holesMm.length+' holes; '+remnant.defectsMm.length+' defects; awaiting physical verification'});
  });
}