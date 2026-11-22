/// <reference lib="webworker" />
import { solvePreview, type SolveInput } from '../solver';
self.onmessage = (e: MessageEvent<SolveInput>) => {
  try { self.postMessage({ ok: true, value: solvePreview(e.data) }); }
  catch (error) { self.postMessage({ ok: false, error: String(error) }); }
};