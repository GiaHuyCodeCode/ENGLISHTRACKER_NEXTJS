import React from 'react';

export interface FilePdfProps extends React.SVGProps<SVGSVGElement> {
  strokeWidth?: number;
}

export function FilePdf({ className = "w-6 h-6", strokeWidth = 1.5, ...props }: FilePdfProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      {/* P */}
      <path d="M7 12v5" />
      <path d="M7 12h1.8a1.4 1.4 0 0 1 0 2.8H7" />
      {/* D */}
      <path d="M11.5 12v5" />
      <path d="M11.5 12h1.2a2.5 2.5 0 0 1 0 5H11.5" />
      {/* F */}
      <path d="M16.5 12v5" />
      <path d="M16.5 12h2" />
      <path d="M16.5 14.5h1.5" />
    </svg>
  );
}

export default FilePdf;
