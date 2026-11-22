export type Point = { x: number; y: number };
export type Polygon = Point[];
export type RemnantStatus = 'MEASURED' | 'VERIFIED' | 'AVAILABLE' | 'RESERVED' | 'USED' | 'REJECTED';
export interface Remnant {
  id: string;
  label: string;
  material: string;
  thicknessMm: number;
  polygonMm: Polygon;
  holesMm: Polygon[];
  defectsMm: Polygon[];
  areaMm2: number;
  location: string;
  status: RemnantStatus;
  imageId?: string;
  scanId?: string;
  calibrationMethod: 'two-point-manual'|'manual-rectangle'|'aruco-single';
  mmPerPx: number|null;
  calibration?: {
    method:'manual-rectangle'|'aruco-single';
    sourceCorners: [{x:number;y:number},{x:number;y:number},{x:number;y:number},{x:number;y:number}];
    widthMm:number; heightMm:number;
    pixelToMm:[number,number,number,number,number,number,number,number,number];
    markerId?:number; dictionary?:string; qualityWarnings:string[];
    independentCheck?:{measuredMm:number;errorMm:number;relativeError:number;passed:boolean;expectedMm:number};
  };
  revision: number;
  createdAt: string;
  updatedAt: string;
}
export interface ImageAsset { id: string; blob: Blob; normalizedBlob?: Blob; mime: string; createdAt: string }
export type PhotoSource='camera'|'upload';
export interface ScanRecord {
  id: string; imageId: string; status: 'CAPTURED'|'MEASURED';
  source: PhotoSource; width: number; height: number;
  qualityWarnings: string[]; conversion: 'native'|'heic-converted';
  originalMime: string; originalName?: string;
  createdAt: string; remnantId?: string;
}
export interface Part {
  id: string; name: string; polygonMm: Polygon; quantity: number;
  thicknessMm: number; material: string; allowQuarterTurns: boolean;
}
export interface Placement { partId: string; x: number; y: number; rotation: number; polygonMm: Polygon }
export interface NestingResult {
  remnantId: string; placements: Placement[]; unplaced: string[];
  clearanceMm: number; checkedCandidates: number; algorithm: string; valid: boolean;
  createdAt: string;
}
export interface AuditEvent { id: string; at: string; action: string; entityId: string; detail: string }