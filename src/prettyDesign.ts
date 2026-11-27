/** Approved Manta reference units; apply screen scale only at the component. */
export const DESIGN={
  clock:58,clockWeight:700,date:17,brand:16,weekday:15,dateNumber:26,
  heading:21,headingWeight:650,body:18,bodyWeight:500,eventWeight:600,
  secondary:13,secondaryWeight:500,action:13,overflow:16,overflowWeight:700,
  overdue:11,headingHeight:53,eventMin:32,rowMin:36,eventLine:1.12,rowLine:1.15,
  rowPadY:4,rowPadX:4,iconGap:6,outerMargin:15,quickRow:36,quickIcon:24,quickPadY:3,quickPadX:6,quickGap:2,
  lightDivider:.8,heavyDivider:1.8,
} as const;
export type DashboardWeight=400|500|600|650|700;
/** Explicit static weights prevent Android from approximating a variable 650 face. */
export const dashboardFont=(weight:DashboardWeight)=>'GoogleSansFlex'+weight;
