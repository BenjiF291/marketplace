/* Heights supplied by the creature comparison chart. Metres are visual, not combat stats. */
export const CREATURE_HEIGHTS_METRES=Object.freeze({snail:.45,fox:.65,dragon:1.2,velkris:1.4,'krynn-species':1.6,krynn:1.6,talren:2,'northern-talren':2.1,'defender-talren':2.2,kanji:2.3,'rill-species':2.6,rill:2.6,'defender-rill':2.7,trusk:3,'fenra-species':3.3,fenra:3.3,'brugar-species':4,brugar:4,veyrin:5,tharos:5.5});
export const heightMetres=kind=>CREATURE_HEIGHTS_METRES[kind]??2.6;
// One metre-to-scene conversion and one fixed camera preserve real stable comparisons.
export const stableHeight=kind=>heightMetres(kind)*.5;
// Square-root compression keeps the order while reducing the 12.2x range to 3.5x.
export const brawlHeight=kind=>1.85*Math.sqrt(heightMetres(kind)/2.6);
