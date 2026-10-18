import { Mail, Phone } from 'lucide-react';
import type { PayCompany } from './types';

/** Branding perusahaan di atas halaman pembayaran publik. */
export function CompanyHeader({ company }: { company: PayCompany }) {
    const name = company.company_name || 'Invoice';

    return (
        <header className="flex items-center gap-3">
            {company.company_logo_path ? (
                <img
                    src={`/storage/${company.company_logo_path}`}
                    alt={name}
                    className="h-10 max-w-[160px] shrink-0 object-contain sm:h-12"
                />
            ) : (
                <div
                    className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary text-lg font-semibold text-primary-foreground sm:size-12"
                    aria-hidden
                >
                    {name.slice(0, 1).toUpperCase()}
                </div>
            )}
            <div className="min-w-0">
                <p className="truncate leading-tight font-semibold">{name}</p>
                <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    {company.company_phone && (
                        <a
                            href={`tel:${company.company_phone}`}
                            className="inline-flex items-center gap-1 hover:text-foreground"
                        >
                            <Phone className="size-3" aria-hidden />
                            {company.company_phone}
                        </a>
                    )}
                    {company.company_email && (
                        <a
                            href={`mailto:${company.company_email}`}
                            className="inline-flex min-w-0 items-center gap-1 hover:text-foreground"
                        >
                            <Mail className="size-3 shrink-0" aria-hidden />
                            <span className="truncate">
                                {company.company_email}
                            </span>
                        </a>
                    )}
                </div>
            </div>
        </header>
    );
}
