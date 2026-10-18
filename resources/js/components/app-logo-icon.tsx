import type { SVGAttributes } from 'react';

/** Ikon eTagih: struk tagihan dengan tepi bawah bergerigi. Warna mengikuti `fill`. */
export default function AppLogoIcon(props: SVGAttributes<SVGElement>) {
    return (
        <svg {...props} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M5 2.75A.75.75 0 0 1 5.75 2h12.5a.75.75 0 0 1 .75.75v18.1a.6.6 0 0 1-.94.5l-1.9-1.3-2.03 1.39a.6.6 0 0 1-.68 0L11.4 20.05l-2.03 1.39a.6.6 0 0 1-.68 0l-2.03-1.39-.72.49A.6.6 0 0 1 5 20.04V2.75ZM8 7a1 1 0 0 1 1-1h6a1 1 0 1 1 0 2H9a1 1 0 0 1-1-1Zm1 3a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2H9Zm-1 5a1 1 0 0 1 1-1h3a1 1 0 1 1 0 2H9a1 1 0 0 1-1-1Z"
            />
        </svg>
    );
}
