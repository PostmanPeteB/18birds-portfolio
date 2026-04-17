// Sanitized portfolio sample from 18Birds.
// Demonstrates reusable admin UI field abstractions with typed props,
// accessible labeling, and consistent input/select patterns.

import type { CSSProperties, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

const visuallyHiddenLabelStyle: CSSProperties = {
  border: 0,
  clip: "rect(0 0 0 0)",
  height: "1px",
  margin: "-1px",
  overflow: "hidden",
  padding: 0,
  position: "absolute",
  whiteSpace: "nowrap",
  width: "1px",
};

type AdminToolbarFieldWrapperProps = {
  label: string;
  htmlFor: string;
  children: ReactNode;
};

function AdminToolbarFieldWrapper({
  label,
  htmlFor,
  children,
}: AdminToolbarFieldWrapperProps) {
  return (
    <>
      <label htmlFor={htmlFor} style={visuallyHiddenLabelStyle}>
        {label}
      </label>
      {children}
    </>
  );
}

type AdminToolbarInputProps = InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
};

export function AdminToolbarTextField({
  id,
  label,
  className,
  ...inputProps
}: AdminToolbarInputProps) {
  return (
    <AdminToolbarFieldWrapper htmlFor={id} label={label}>
      <input
        id={id}
        aria-label={label}
        className={className ?? "adminDashInput"}
        {...inputProps}
      />
    </AdminToolbarFieldWrapper>
  );
}

type AdminToolbarSelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  id: string;
  label: string;
  children: ReactNode;
};

export function AdminToolbarSelectField({
  id,
  label,
  className,
  children,
  ...selectProps
}: AdminToolbarSelectProps) {
  return (
    <AdminToolbarFieldWrapper htmlFor={id} label={label}>
      <select
        id={id}
        aria-label={label}
        className={className ?? "adminDashSelect"}
        {...selectProps}
      >
        {children}
      </select>
    </AdminToolbarFieldWrapper>
  );
}
