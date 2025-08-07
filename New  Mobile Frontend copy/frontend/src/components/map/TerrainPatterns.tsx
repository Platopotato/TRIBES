import React from 'react';
import { TerrainType } from '../../types';

const TerrainPatterns = () => (
  <>
    {/* #B4AF8C */}
    <pattern id={`texture-${TerrainType.Plains}`} patternUnits="userSpaceOnUse" width="20" height="20">
      <rect width="20" height="20" fill="#B4AF8C" />
      <path d="M 0 5 C 5 10, 15 0, 20 5 M 0 15 C 5 20, 15 10, 20 15" stroke="#6b6853" strokeWidth="0.5" />
    </pattern>

    {/* #648246 */}
    <pattern id={`texture-${TerrainType.Forest}`} patternUnits="userSpaceOnUse" width="20" height="20">
      <rect width="20" height="20" fill="#648246" />
      <circle cx="5" cy="5" r="3" fill="#4b6134" />
      <circle cx="15" cy="15" r="4" fill="#4b6134" />
      <circle cx="10" cy="8" r="2" fill="#3a4a28" />
    </pattern>

    {/* #D2BE96 */}
    <pattern id={`texture-${TerrainType.Desert}`} patternUnits="userSpaceOnUse" width="20" height="20">
      <rect width="20" height="20" fill="#D2BE96" />
      <path d="M -5 5 C 5 0, 15 10, 25 5" stroke="#a48e6c" strokeWidth="1.5" fill="none" />
      <path d="M -5 15 C 5 10, 15 20, 25 15" stroke="#a48e6c" strokeWidth="1.5" fill="none" />
    </pattern>

    {/* #786E64 */}
    <pattern id={`texture-${TerrainType.Mountains}`} patternUnits="userSpaceOnUse" width="30" height="30">
      <rect width="30" height="30" fill="#786E64" />
      <path d="M -5 15 L 15 0 L 20 10 L 35 5" stroke="#4a433d" strokeWidth="3" fill="none" />
      <path d="M -5 25 L 10 10 L 18 15 L 35 15" stroke="#3b3531" strokeWidth="2" fill="none" />
    </pattern>

    {/* #96826E */}
    <pattern id={`texture-${TerrainType.Ruins}`} patternUnits="userSpaceOnUse" width="16" height="16">
      <rect width="16" height="16" fill="#96826E" />
      <path d="M 0 0 H 16 M 0 8 H 16 M 0 16 H 16 M 0 0 V 16 M 8 0 V 16 M 16 0 V 16" stroke="#5f5145" strokeWidth="0.5" />
    </pattern>

    {/* #A08C78 */}
    <pattern id={`texture-${TerrainType.Wasteland}`} patternUnits="userSpaceOnUse" width="25" height="25">
      <rect width="25" height="25" fill="#A08C78" />
      <path d="M 0 25 L 25 0 M 10 25 L 25 10 M 0 10 L 10 0" stroke="#6c5a4b" strokeWidth="1" />
    </pattern>

    {/* #508CBE */}
    <pattern id={`texture-${TerrainType.Water}`} patternUnits="userSpaceOnUse" width="20" height="20">
        <rect width="20" height="20" fill="#508CBE" />
        <path d="M 0 5 C 5 0, 15 10, 20 5" stroke="#36668d" strokeWidth="1.5" fill="none" />
        <path d="M 0 15 C 5 10, 15 20, 20 15" stroke="#2d5472" strokeWidth="1.5" fill="none" />
    </pattern>

    {/* #78B450 */}
    <pattern id={`texture-${TerrainType.Radiation}`} patternUnits="userSpaceOnUse" width="20" height="20">
      <rect width="20" height="20" fill="#78B450" />
      <circle cx="10" cy="10" r="8" fill="transparent" stroke="#bef264" strokeWidth="1.5" />
      <circle cx="10" cy="10" r="4" fill="#a3e635" />
    </pattern>
    
    {/* #5A5046 */}
    <pattern id={`texture-${TerrainType.Crater}`} patternUnits="userSpaceOnUse" width="40" height="40">
        <rect width="40" height="40" fill="#5A5046" />
        <circle cx="20" cy="20" r="15" stroke="#3b3531" fill="none" strokeWidth="1"/>
        <circle cx="20" cy="20" r="10" stroke="#292524" fill="none" strokeWidth="2"/>
    </pattern>
    
    {/* #6E965A */}
    <pattern id={`texture-${TerrainType.Swamp}`} patternUnits="userSpaceOnUse" width="30" height="30">
        <rect width="30" height="30" fill="#6E965A" />
        <path d="M 0 10 C 10 5, 20 15, 30 10" stroke="#4c663d" strokeWidth="3" fill="none" />
        <path d="M 0 25 C 10 20, 20 30, 30 25" stroke="#3f5133" strokeWidth="3" fill="none" />
    </pattern>

    <pattern id="fog-pattern" patternUnits="userSpaceOnUse" width="10" height="10">
      <rect width="10" height="10" fill="black" />
      <path d="M -1 1 L 2 4 M 0 10 L 10 0 M 8 11 L 11 8" stroke="#1a1a1a" strokeWidth="0.5" />
    </pattern>
  </>
);

export default TerrainPatterns;