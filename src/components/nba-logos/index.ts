import type { ComponentType } from "react";

// Cada arquivo em ./Icons exporta um componente React (SVG) com prop `size`
export type NbaLogoComponent = ComponentType<{ size?: string | number }>;

import atl from "./Icons/atl";
import bkn from "./Icons/bkn";
import bos from "./Icons/bos";
import cha from "./Icons/cha";
import chi from "./Icons/chi";
import cle from "./Icons/cle";
import dal from "./Icons/dal";
import den from "./Icons/den";
import det from "./Icons/det";
import gsw from "./Icons/gsw";
import hou from "./Icons/hou";
import ind from "./Icons/ind";
import lac from "./Icons/lac";
import lal from "./Icons/lal";
import mem from "./Icons/mem";
import mia from "./Icons/mia";
import mil from "./Icons/mil";
import min from "./Icons/min";
import nop from "./Icons/nop";
import nyk from "./Icons/nyk";
import okc from "./Icons/okc";
import orl from "./Icons/orl";
import phi from "./Icons/phi";
import phx from "./Icons/phx";
import por from "./Icons/por";
import sac from "./Icons/sac";
import sas from "./Icons/sas";
import tor from "./Icons/tor";
import uta from "./Icons/uta";
import was from "./Icons/was";

export const NBA_LOGOS: Record<string, NbaLogoComponent> = {
  atl,
  bkn,
  bos,
  cha,
  chi,
  cle,
  dal,
  den,
  det,
  gsw,
  hou,
  ind,
  lac,
  lal,
  mem,
  mia,
  mil,
  min,
  nop,
  nyk,
  okc,
  orl,
  phi,
  phx,
  por,
  sac,
  sas,
  tor,
  uta,
  was,
};

