import React from 'react';

type CheckboxProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> & {
    label?: string;
};

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
    ({ label, className = '', ...props }, ref) => {
        return (
            <div className="flex items-center gap-2">
                <input
                    type="checkbox"
                    ref={ref}
                    className={`
                        appearance-none
                        size-5
                        rounded-md
                        border-2
                        border-surface
                        bg-surface
                        checked:bg-primary
                        checked:border-primary
                        focus:ring-2
                        focus:ring-primary
                        focus:ring-offset-2
                        dark:focus:ring-offset-zinc-900
                        cursor-pointer
                        transition-all
                        relative
                        after:content-['']
                        after:absolute
                        after:left-[6px]
                        after:top-[2px]
                        after:w-[5px]
                        after:h-[10px]
                        after:border-r-2
                        after:border-b-2
                        after:border-white
                        dark:after:border-zinc-900
                        after:rotate-45
                        after:opacity-0
                        checked:after:opacity-100
                        ${className}
                    `}
                    {...props}
                />
                {label && (
                    <label className="text-sm text-main select-none">
                        {label}
                    </label>
                )}
            </div>
        );
    }
);
