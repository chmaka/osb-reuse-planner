# CNC safety — mandatory

Phase 0 DXF entities use only REFERENCE_ONLY and DEFECT_REFERENCE layers. Do not treat exports as cut paths.

Before future Cut2D production, an operator must physically verify actual board dimensions, thickness, material integrity, clamps/hold-down, safe machine envelope (historical ~2200 x 4000 mm), cutter diameter, tool compensation, internal radii, hold-down tabs, origin, work zero, dry-run and CAM simulation.

Historical spindle speeds/feeds are not validated recommendations. No direct Mach3 interaction, G-code or automatic consumption status is permitted. Structural use of OSB offcuts is out of scope without engineering review.
