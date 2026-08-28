"use client";

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="m-btn m-noprint">
      Print report
    </button>
  );
}
