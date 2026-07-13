import { forwardRef } from 'react';

interface Props {
  /** Called with the chosen file (or undefined if the picker was dismissed). */
  onFile: (file: File | undefined) => void;
  accept?: string;
}

/**
 * A hidden `<input type="file">` triggered via a ref. Resets its value after
 * each pick so choosing the same file twice still fires `onChange`.
 */
export const HiddenFileInput = forwardRef<HTMLInputElement, Props>(
  function HiddenFileInput({ onFile, accept = 'application/json' }, ref) {
    return (
      <input
        ref={ref}
        type="file"
        accept={accept}
        hidden
        onChange={(e) => {
          onFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
    );
  },
);
