import Dexie, { type EntityTable } from 'dexie';
import type { Remnant, ImageAsset, Part, AuditEvent } from './types';
export const db = new Dexie('meditera-osb-reuse-lab') as Dexie & {
  remnants: EntityTable<Remnant,'id'>;
  images: EntityTable<ImageAsset,'id'>;
  parts: EntityTable<Part,'id'>;
  audit: EntityTable<AuditEvent,'id'>;
};
db.version(1).stores({
  remnants: 'id, material, thicknessMm, location, status, createdAt',
  images: 'id, createdAt',
  parts: 'id, material, thicknessMm',
  audit: 'id, at, entityId'
});
export async function storeScan(remnant: Remnant, image: Blob): Promise<void> {
  await db.transaction('rw',db.remnants,db.images,db.audit,async()=>{
    if(remnant.imageId) await db.images.put({
      id:remnant.imageId,blob:image,mime:image.type,createdAt:new Date().toISOString()
    });
    await db.remnants.add(remnant);
    await db.audit.add({id:crypto.randomUUID(),at:new Date().toISOString(),
      action:'SCAN_MEASURED',entityId:remnant.id,detail:'Manual two-point scale; awaiting verification'});
  });
}