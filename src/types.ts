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
  segmentation?: {
    algorithm:string; threshold:number; coverage:number;pixelStep:number;
    reviewed:boolean;edited:boolean;manualCorrections:boolean;notes:string[]
  };
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
export interface ScanDraft {
  mode:'scale'|'check'|'trace';
  calMode:'line'|'rectangle'|'marker';
  refPoints:Point[];quadPoints:Point[];checkPoints:Point[];
  contour:Point[];holesMmDraft:Polygon[];defectsMmDraft:Polygon[];
  pendingRing:Point[];proposedHoles:Polygon[];
  markers:{id:number;hammingDistance:number;corners:[Point,Point,Point,Point]}[];
  chosenMarker:number|null;
  knownDistance:string;cardWidth:string;cardHeight:string;
  markerSize:string;markerId:string;checkDistance:string;
  segmentThreshold:string;foregroundSeed:Point|null;
  drawLayer:'outer'|'hole'|'defect';
  segmentation:{
    algorithm:string;threshold:number;coverage:number;pixelStep:number;
    reviewed:boolean;edited:boolean;notes:string[]
  }|null;
  name:string;location:string;thickness:string;updatedAt:string;
}
export interface ScanRecord {
  id: string; imageId: string; status: 'CAPTURED'|'MEASURED';
  source: PhotoSource; width: number; height: number;
  qualityWarnings: string[]; conversion: 'native'|'heic-converted';
  originalMime: string; originalName?: string;
  createdAt: string; remnantId?: string;draft?:ScanDraft;
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
/** Audit-only, externally measured bounding dimensions. A record never promotes a remnant to VERIFIED. */
export interface ValidationTrial {
  id:string;at:string;remnantId:string;remnantLabel:string;remnantRevision:number;
  calibrationMethod:Remnant['calibrationMethod'];algorithm:string;
  predictedWidthMm:number;predictedHeightMm:number;
  actualWidthMm:number;actualHeightMm:number;toleranceMm:number;
  device:string;lighting:string;referenceMethod:string;notes:string;
}
