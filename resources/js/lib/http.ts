/**
 * Helper kecil untuk endpoint JSON internal (bukan kunjungan Inertia):
 * menyertakan cookie sesi + header XSRF Laravel.
 */

function xsrfToken(): string {
    const raw =
        document.cookie
            .split('; ')
            .find((c) => c.startsWith('XSRF-TOKEN='))
            ?.split('=')[1] ?? '';

    return decodeURIComponent(raw);
}

function headers(): Record<string, string> {
    return {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-XSRF-TOKEN': xsrfToken(),
    };
}

export class HttpError extends Error {
    constructor(
        public status: number,
        message: string,
    ) {
        super(message);
    }
}

async function parse<T>(res: Response): Promise<T> {
    const data = (await res.json().catch(() => ({}))) as T & {
        message?: string;
    };

    if (!res.ok) {
        throw new HttpError(
            res.status,
            data?.message ?? `Permintaan gagal (HTTP ${res.status}).`,
        );
    }

    return data;
}

export async function getJson<T>(
    url: string,
    signal?: AbortSignal,
): Promise<T> {
    const res = await fetch(url, {
        headers: headers(),
        credentials: 'same-origin',
        signal,
    });

    return parse<T>(res);
}

export async function postJson<T = unknown>(
    url: string,
    body: unknown = {},
): Promise<T> {
    const res = await fetch(url, {
        method: 'POST',
        headers: headers(),
        credentials: 'same-origin',
        body: JSON.stringify(body),
    });

    return parse<T>(res);
}
