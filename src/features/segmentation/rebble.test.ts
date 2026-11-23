import {describe,it,expect} from 'vitest';
import {markerPromptPoints,maskToRebbleContours,metricDimensions,removeMarkerOcclusions} from './rebble';
import type {Point} from '../../types';
const p=(x:number,y:number):Point=>({x,y});
const marker={id:4,hammingDistance:0,corners:[p(40,40),p(60,40),p(60,60),p(40,60)] as [Point,Point,Point,Point]};
describe('Re:bble inspired marker guided scanner',()=>{
 it('computes four marker-offset prompts (Re:bble algorithm) in image coordinates',()=>{
  expect(markerPromptPoints(marker,150,120)).toEqual([
    {x:32.5,y:32.5,label:1},{x:67.5,y:32.5,label:1},
    {x:67.5,y:67.5,label:1},{x:32.5,y:67.5,label:1}
  ]);
 });
 it('clamps points near photo boundary',()=>{
  const m={...marker,corners:[p(0,0),p(12,0),p(12,12),p(0,12)] as [Point,Point,Point,Point]};
  expect(markerPromptPoints(m,100,100).every(a=>a.x>=0&&a.y>=0)).toBe(true);
 });
 it('converts a binary SAM mask to editable contours, excluding printed marker hole',()=>{
  const w=160,h=140,mask=new Uint8Array(w*h);
  for(let y=18;y<118;y++)for(let x=15;x<146;x++)mask[y*w+x]=1;
  for(let y=41;y<60;y++)for(let x=41;x<60;x++)mask[y*w+x]=0;// marker
  for(let y=72;y<90;y++)for(let x=101;x<125;x++)mask[y*w+x]=0;// genuine opening
  const c=maskToRebbleContours({width:w,height:h,imageWidth:320,imageHeight:280,data:mask},{
    id:4,hammingDistance:0,corners:[p(80,80),p(120,80),p(120,120),p(80,120)]
  });
  expect(c.holes).toHaveLength(1);
  expect(c.outer.length).toBeGreaterThanOrEqual(4);
  expect(c.outer.every(v=>Number.isFinite(v.x+v.y))).toBe(true);
 });
 it('does not hide a physically separate opening far from marker',()=>{
  expect(removeMarkerOcclusions([
    [p(45,45),p(56,45),p(56,55),p(45,55)],
    [p(110,92),p(123,92),p(123,104),p(110,104)]
  ],marker)).toHaveLength(1);
 });
 it('measures width height and net area in millimeters',()=>{
  const result=metricDimensions([p(0,0),p(200,0),p(200,120),p(0,120)],
  [[p(10,10),p(30,10),p(30,20),p(10,20)]]);
  expect(result).toEqual({widthMm:200,heightMm:120,outerAreaMm2:24000,netAreaMm2:23800});
 });
 it('refuses blank, full and tiny SAM masks',()=>{
  expect(()=>maskToRebbleContours({width:100,height:100,data:new Uint8Array(10000),
    imageWidth:100,imageHeight:100},marker)).toThrow();
  expect(()=>maskToRebbleContours({width:100,height:100,data:new Uint8Array(10000).fill(1),
    imageWidth:100,imageHeight:100},marker)).toThrow();
 });
});
