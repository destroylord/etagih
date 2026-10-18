import { ImageUp, RotateCcw, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';

const ACCEPT = ['image/jpeg', 'image/png'];

/**
 * Upload gambar (logo / tanda tangan) JPG/PNG dengan pratinjau, ganti & hapus.
 * Server me-resize otomatis.
 */
export function LogoUpload({
    currentPath,
    file,
    removed,
    onFileChange,
    onRemoveChange,
    error,
    noun = 'logo',
    maxMb = 5,
    sizeHint = 'Otomatis diperkecil ke 600×200 px.',
    transparentPreview = false,
}: {
    /** Nama objek untuk label tombol, mis. "logo" / "tanda tangan". */
    noun?: string;
    maxMb?: number;
    sizeHint?: string;
    /** Latar kotak-kotak supaya area transparan PNG terlihat. */
    transparentPreview?: boolean;
    currentPath: string | null;
    file: File | null;
    removed: boolean;
    onFileChange: (file: File | null) => void;
    onRemoveChange: (removed: boolean) => void;
    error?: string;
}) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [localError, setLocalError] = useState<string | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    useEffect(() => {
        if (!file) {
            return;
        }

        const url = URL.createObjectURL(file);
        // eslint-disable-next-line react-hooks/set-state-in-effect -- sinkron dengan object URL eksternal
        setPreviewUrl(url);

        return () => {
            URL.revokeObjectURL(url);
            setPreviewUrl(null);
        };
    }, [file]);

    const shownSrc = file
        ? previewUrl
        : currentPath && !removed
          ? `/storage/${currentPath}`
          : null;

    const pick = (f: File | undefined) => {
        setLocalError(null);

        if (!f) {
            return;
        }

        if (!ACCEPT.includes(f.type)) {
            setLocalError('Format harus JPG atau PNG.');

            return;
        }

        if (f.size > maxMb * 1024 * 1024) {
            setLocalError(`Ukuran file maksimal ${maxMb} MB.`);

            return;
        }

        onRemoveChange(false);
        onFileChange(f);
    };

    const clearNew = () => {
        onFileChange(null);

        if (inputRef.current) {
            inputRef.current.value = '';
        }
    };

    return (
        <div className="space-y-2">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div
                    className="grid h-20 w-full shrink-0 place-items-center overflow-hidden rounded-lg border border-dashed bg-muted/40 p-2 sm:w-48"
                    style={
                        transparentPreview
                            ? {
                                  backgroundColor: '#fff',
                                  backgroundImage:
                                      'linear-gradient(45deg,#eee 25%,transparent 25%),linear-gradient(-45deg,#eee 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#eee 75%),linear-gradient(-45deg,transparent 75%,#eee 75%)',
                                  backgroundSize: '14px 14px',
                                  backgroundPosition:
                                      '0 0,0 7px,7px -7px,-7px 0',
                              }
                            : undefined
                    }
                >
                    {shownSrc ? (
                        <img
                            src={shownSrc}
                            alt={noun}
                            className="max-h-full max-w-full object-contain"
                        />
                    ) : (
                        <span className="text-xs text-muted-foreground">
                            {removed
                                ? `${capitalize(noun)} akan dihapus`
                                : `Belum ada ${noun}`}
                        </span>
                    )}
                </div>
                <div className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => inputRef.current?.click()}
                        >
                            <ImageUp />{' '}
                            {shownSrc ? `Ganti ${noun}` : `Unggah ${noun}`}
                        </Button>
                        {file && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={clearNew}
                            >
                                <RotateCcw /> Batal ganti
                            </Button>
                        )}
                        {!file && currentPath && !removed && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="text-red-600 dark:text-red-400"
                                onClick={() => onRemoveChange(true)}
                            >
                                <Trash2 /> Hapus
                            </Button>
                        )}
                        {!file && removed && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => onRemoveChange(false)}
                            >
                                <RotateCcw /> Urungkan
                            </Button>
                        )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                        {file
                            ? `${file.name} · ${(file.size / 1024).toFixed(0)} KB · `
                            : ''}
                        JPG/PNG maks. {maxMb} MB. {sizeHint}
                    </p>
                </div>
            </div>
            <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png"
                className="sr-only"
                tabIndex={-1}
                aria-hidden
                onChange={(e) => pick(e.target.files?.[0])}
            />
            {(localError || error) && (
                <p className="text-xs text-red-600 dark:text-red-400">
                    {localError ?? error}
                </p>
            )}
        </div>
    );
}

function capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
}
