import React, {
  useState,
  InputHTMLAttributes,
  TextareaHTMLAttributes,
  SelectHTMLAttributes,
  ReactNode,
} from "react";

type BaseProps = {
  inputType?: "input" | "textarea" | "select";
  className?: string;
};

// Input variant
type InputProps = BaseProps & {
  inputType?: "input";
  children?: never;
} & InputHTMLAttributes<HTMLInputElement>;

// Textarea variant
type TextareaProps = BaseProps & {
  inputType: "textarea";
  children?: ReactNode;
} & TextareaHTMLAttributes<HTMLTextAreaElement>;

// Select variant
type SelectProps = BaseProps & {
  inputType: "select";
  children: ReactNode;
} & SelectHTMLAttributes<HTMLSelectElement>;

// Combined props
type FormInputProps = InputProps | TextareaProps | SelectProps;

const FormInput: React.FC<FormInputProps> = ({
  inputType = "input",
  className = "",
  children,
  ...props
}) => {
  const baseClasses =
    "mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-400 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm lg:text-base";
  const combinedClasses = `${baseClasses} ${className}`;

  if (inputType === "textarea") {
    return (
      <textarea
        className={combinedClasses}
        {...(props as TextareaHTMLAttributes<HTMLTextAreaElement>)}
      >
        {children}
      </textarea>
    );
  }

  if (inputType === "select") {
    return (
      <select
        className={combinedClasses}
        {...(props as SelectHTMLAttributes<HTMLSelectElement>)}
      >
        {children}
      </select>
    );
  }

  // inputType === "input"
  if (children && process.env.NODE_ENV !== "production") {
    console.warn("⚠️ FormInput: `children` is ignored when `inputType` is 'input'.");
  }

  // Handle type="date" extras
  const inputProps = props as InputHTMLAttributes<HTMLInputElement>;

  const isDateType = inputProps.type === "date";
  const isNumberType = inputProps.type === "number";

  const [dateInputType, setDateInputType] = useState<"text" | "date">(inputProps.value ? "date" : "text");

  const dateProps = isDateType
    ? {
        max: inputProps.max ?? '9999-12-31',
        placeholder: inputProps.placeholder ?? "mm/dd/yyyy",
        onFocus: (e: React.FocusEvent<HTMLInputElement>) => {
          e.preventDefault();
          setDateInputType("date");
        },
        onBlur: () => {
          if (!inputProps.value) setDateInputType("text");
        },
        type: dateInputType,
        readOnly: dateInputType == "text",
      }
    : {};

  const numberProps = isNumberType
    ? {
        inputMode: inputProps.inputMode ?? 'decimal',
      }
    : {};

  const newCombinedClasses = isDateType ? combinedClasses + " appearance-none" : combinedClasses;

  return (
    <input
      className={newCombinedClasses}
      {...(props as InputHTMLAttributes<HTMLInputElement>)}
      {...dateProps}
      {...numberProps}
    />
  );
};

export default FormInput;