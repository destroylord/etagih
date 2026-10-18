<?php

namespace App\Support;

/**
 * Pembuat file .xlsx (SpreadsheetML) tanpa library tambahan.
 *
 * ZIP ditulis mentah dengan metode STORE (tanpa kompresi) - valid untuk
 * Excel / LibreOffice / Google Sheets, dan tidak bergantung pada ekstensi
 * ZipArchive (tidak tersedia di env ini).
 *
 * Mendukung styling sederhana:
 *  - sel diberi gaya lewat index XlsxWriter::XF_* (header, border, currency Rp, dst.)
 *  - lebar kolom & freeze baris header per sheet.
 */
class XlsxWriter
{
    // Cell style XF indexes (harus sinkron dengan definisi cellXfs di styles()).
    public const XF_DEFAULT = 0;

    public const XF_BOLD = 1;

    public const XF_HEADER = 2;

    public const XF_MONEY = 3;

    public const XF_MONEY_BOLD = 4;

    public const XF_NUMBER = 5;

    public const XF_SECTION = 6;

    public const XF_TABLE = 7;

    public const XF_TABLE_MONEY = 8;

    public const XF_TABLE_MONEY_BOLD = 9;

    public const XF_TOTAL_MONEY = 10;

    public const XF_CENTER = 11;

    public const XF_TABLE_NUMBER = 12;

    public const XF_TABLE_BOLD = 13;

    public const XF_TOTAL_LABEL = 14;

    /** @var array<int, array{name: string, xml: string}> */
    private array $sheets = [];

    /**
     * @param  string  $name  nama sheet (dibersihkan otomatis)
     * @param  array<int, array<int, scalar|null|array{v: scalar|null, s?: int}|array{}>>  $rows
     *                                                                                            tiap sel: scalar|null untuk gaya default, atau array{v: nilai, s: index XF_*}
     * @param  array{columns?: array<int, float>, freeze?: int}  $opts  lebar kolom & jumlah header freeze
     */
    public function addSheet(string $name, array $rows, array $opts = []): void
    {
        $safe = str_replace(['[', ']', ':', '*', '?', '/', chr(92)], '-', $name);
        $safe = mb_substr($safe, 0, 31);

        $this->sheets[] = [
            'name' => $safe,
            'xml' => $this->sheetXml($rows, $opts['columns'] ?? [], (int) ($opts['freeze'] ?? 0)),
        ];
    }

    public function build(): string
    {
        $sheetCount = count($this->sheets);

        $entries = [];
        $entries[] = ['name' => '[Content_Types].xml', 'data' => $this->contentTypes($sheetCount)];
        $entries[] = ['name' => '_rels/.rels', 'data' => $this->rootRels()];

        for ($i = 0; $i < $sheetCount; $i++) {
            $entries[] = ['name' => 'xl/worksheets/sheet'.($i + 1).'.xml', 'data' => $this->sheets[$i]['xml']];
        }

        $entries[] = ['name' => 'xl/styles.xml', 'data' => $this->styles()];
        $entries[] = ['name' => 'xl/workbook.xml', 'data' => $this->workbook($sheetCount)];
        $entries[] = ['name' => 'xl/_rels/workbook.xml.rels', 'data' => $this->workbookRels($sheetCount)];

        return $this->zip($entries);
    }

    /** @return resource (php://temp stream) */
    public function stream()
    {
        $stream = fopen('php://temp', 'r+');
        if ($stream === false) {
            throw new \RuntimeException('Tidak bisa membuka stream sementara.');
        }
        fwrite($stream, $this->build());
        rewind($stream);

        return $stream;
    }

    /**
     * @param  array<int, array{name: string, data: string}>  $entries
     */
    private function zip(array $entries): string
    {
        $local = '';
        $central = '';
        $offset = 0;

        foreach ($entries as $entry) {
            $name = $entry['name'];
            $data = $entry['data'];
            $crc = crc32($data);
            $size = strlen($data);
            $nameLen = strlen($name);

            $local .= pack('VvvvvvVVVvv', 0x04034B50, 20, 0, 0, $this->dosTime(), $this->dosDate(), $crc, $size, $size, $nameLen, 0)
                .$name.$data;

            $central .= pack('VvvvvvvVVVvvvvvVV', 0x02014B50, 20, 20, 0, 0, $this->dosTime(), $this->dosDate(), $crc, $size, $size, $nameLen, 0, 0, 0, 0, 0, $offset)
                .$name;

            $offset += 30 + $nameLen + $size;
        }

        $count = count($entries);
        $eocd = pack('VvvvvVVv', 0x06054B50, 0, 0, $count, $count, strlen($central), $offset, 0);

        return $local.$central.$eocd;
    }

    private function dosTime(): int
    {
        return ((int) date('H') << 11) | ((int) date('i') << 5) | intdiv((int) date('s'), 2);
    }

    private function dosDate(): int
    {
        return (((int) date('Y') - 1980) << 9) | ((int) date('m') << 5) | (int) date('d');
    }

    /**
     * @param  array<int, array<int, scalar|null|array{v: scalar|null, s?: int}|array{}>>  $rows
     * @param  array<int, float>  $columns
     */
    private function sheetXml(array $rows, array $columns = [], int $freeze = 0): string
    {
        $out = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'."\n";
        $out .= '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>';

        $r = 1;
        foreach ($rows as $row) {
            $xmlRow = "<row r=\"{$r}\">";
            for ($c = 0, $n = count($row); $c < $n; $c++) {
                $cell = $row[$c];
                $xf = 0;
                if (is_array($cell)) {
                    $value = $cell['v'] ?? null;
                    $xf = (int) ($cell['s'] ?? 0);
                } else {
                    $value = $cell;
                }
                if ($value === null) {
                    continue;
                }
                $ref = $this->col($c).$r;
                $sAttr = $xf !== 0 ? ' s="'.$xf.'"' : '';
                if (is_int($value) || is_float($value)) {
                    $xmlRow .= '<c r="'.$ref.'"'.$sAttr.'><v>'.$value.'</v></c>';
                } else {
                    $xmlRow .= '<c r="'.$ref.'"'.$sAttr.' t="inlineStr"><is><t xml:space="preserve">'.$this->esc((string) $value).'</t></is></c>';
                }
            }
            $xmlRow .= '</row>';
            $out .= $xmlRow;
            $r++;
        }

        return $out.'</sheetData></worksheet>';
    }

    private function col(int $i): string
    {
        $i++;
        $s = '';
        while ($i > 0) {
            $i--;
            $s = chr(65 + ($i % 26)).$s;
            $i = intdiv($i, 26);
        }

        return $s;
    }

    private function esc(string $s): string
    {
        return htmlspecialchars($s, ENT_XML1 | ENT_QUOTES, 'UTF-8');
    }

    private function contentTypes(int $sheetCount): string
    {
        $xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'."\n";
        $xml .= '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">';
        $xml .= '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>';
        $xml .= '<Default Extension="xml" ContentType="application/xml"/>';
        $xml .= '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>';
        for ($i = 1; $i <= $sheetCount; $i++) {
            $xml .= '<Override PartName="/xl/worksheets/sheet'.$i.'.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';
        }
        $xml .= '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>';

        return $xml.'</Types>';
    }

    private function rootRels(): string
    {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'."\n"
            .'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            .'<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
            .'</Relationships>';
    }

    private function workbook(int $sheetCount): string
    {
        $xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'."\n";
        $xml .= '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>';
        for ($i = 0; $i < $sheetCount; $i++) {
            $xml .= '<sheet name="'.$this->esc($this->sheets[$i]['name']).'" sheetId="'.($i + 1).'" r:id="rId'.($i + 1).'"/>';
        }

        return $xml.'</sheets></workbook>';
    }

    private function workbookRels(int $sheetCount): string
    {
        $xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'."\n";
        $xml .= '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">';
        for ($i = 1; $i <= $sheetCount; $i++) {
            $xml .= '<Relationship Id="rId'.$i.'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet'.$i.'.xml"/>';
        }
        $relStyle = $sheetCount + 1;
        $xml .= '<Relationship Id="rId'.$relStyle.'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>';

        return $xml.'</Relationships>';
    }

    private function styles(): string
    {

        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'."\n"
            .'<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
            .'<numFmts count="3">'
            .'<numFmt numFmtId="164" formatCode="&quot;Rp&quot; #,##0.00"/>'
            .'<numFmt numFmtId="165" formatCode="#,##0.00"/>'
            .'<numFmt numFmtId="166" formatCode="#,##0"/>'
            .'</numFmts>'
            .'<fonts count="3">'
            .'<font><sz val="11"/><color rgb="FF000000"/><name val="Calibri"/><family val="2"/></font>'
            .'<font><b/><sz val="11"/><color rgb="FF000000"/><name val="Calibri"/><family val="2"/></font>'
            .'<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font>'
            .'</fonts>'
            .'<fills count="4">'
            .'<fill><patternFill patternType="none"/></fill>'
            .'<fill><patternFill patternType="solid"><fgColor rgb="FF1F4E79"/><bgColor indexed="64"/></patternFill></fill>'
            .'<fill><patternFill patternType="solid"><fgColor rgb="FFD9E1F2"/><bgColor indexed="64"/></patternFill></fill>'
            .'<fill><patternFill patternType="solid"><fgColor rgb="FFFFF2CC"/><bgColor indexed="64"/></patternFill></fill>'
            .'</fills>'
            .'<borders count="2">'
            .'<border><left/><right/><top/><bottom/><diagonal/></border>'
            .'<border><left style="thin"><color rgb="FFB0B0B0"/></left><right style="thin"><color rgb="FFB0B0B0"/></right><top style="thin"><color rgb="FFB0B0B0"/></top><bottom style="thin"><color rgb="FFB0B0B0"/></bottom><diagonal/></border>'
            .'</borders>'
            .'<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
            .'<cellXfs count="15">'
            // 0 default
            .'<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
            // 1 bold
            .'<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>'
            // 2 header
            .'<xf numFmtId="0" fontId="2" fillId="1" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>'
            // 3 money
            .'<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="right"/></xf>'
            // 4 money bold
            .'<xf numFmtId="164" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1" applyAlignment="1"><alignment horizontal="right"/></xf>'
            // 5 number
            .'<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="right"/></xf>'
            // 6 section
            .'<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>'
            // 7 table
            .'<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>'
            // 8 table money
            .'<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>'
            // 9 table money bold
            .'<xf numFmtId="164" fontId="1" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>'
            // 10 total money (fill)
            .'<xf numFmtId="164" fontId="1" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>'
            // 11 center
            .'<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center"/></xf>'
            // 12 table number
            .'<xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>'
            // 13 table bold
            .'<xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>'
            // 14 total label (fill)
            .'<xf numFmtId="0" fontId="1" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>'
            .'</cellXfs>'
            .'<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
            .'</styleSheet>';
    }
}
