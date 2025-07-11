import cds from '@sap/cds';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

cds.on('bootstrap', (app) => {
    console.log('--- [Bootstrap] Adding custom file upload endpoint. ---');

    app.post('/rest/upload', async (req: any, res: any) => {
        console.log('--- [Upload Endpoint] Request received. Manually reading stream... ---');

        const chunks: any[] = [];
        req.on('data', chunk => {
            chunks.push(chunk);
        });

        req.on('error', (err) => {
            console.error('--- [Upload Error] Request stream error:', err);
            res.status(500).send('An error occurred during file upload.');
        });

        req.on('end', async () => {
            try {
                const buffer = Buffer.concat(chunks);
                console.log(`--- [Upload Endpoint] Stream finished. Buffer size: ${buffer.length} bytes. ---`);

                if (buffer.length === 0) {
                    return res.status(400).send('File is missing or empty.');
                }

                let parsedData: { keyword: string; excludedDomains: string; }[] = [];

                const findHeader = (row: any, potentialNames: string[]): string | undefined => {
                    const rowKeys = Object.keys(row);
                    for (const name of potentialNames) {
                        const foundKey = rowKeys.find(key => key.toLowerCase().trim() === name);
                        if (foundKey) return row[foundKey];
                    }
                    return undefined;
                };

                try {
                    const workbook = XLSX.read(buffer, { type: 'buffer' });
                    const sheetName = workbook.SheetNames[0];
                    const sheet = workbook.Sheets[sheetName];
                    const jsonData: any[] = XLSX.utils.sheet_to_json(sheet);

                    if (jsonData.length > 0) {
                        console.log('--- [XLSX Parser] Detected headers:', Object.keys(jsonData[0]));
                    }

                    parsedData = jsonData.reduce((acc: { keyword: string; excludedDomains: string }[], row: any) => {
                        const keyword = findHeader(row, ['keyword', 'keywords'])
                        if (keyword) {
                            acc.push({
                                keyword,
                                excludedDomains: findHeader(row, ['excludeddomains', 'excluded domains']) || ''
                            });
                        }
                        return acc;
                    }, []);

                } catch (xlsxError) {
                    console.log("Could not parse as XLSX, trying CSV.");
                    const csvString = buffer.toString('utf8');
                    const result = Papa.parse(csvString, { header: true, skipEmptyLines: true, transformHeader: header => header.toLowerCase().trim() });
                    
                    if (result.errors.length > 0) throw new Error('CSV parsing failed.');

                    if (result.meta.fields) {
                        console.log('--- [CSV Parser] Detected headers:', result.meta.fields);
                    }
                    
                    const csvData = result.data as any[];

                    parsedData = csvData.reduce((acc: { keyword: string; excludedDomains: string }[], row: any) => {
                        const keyword = row.keyword || row.keywords;
                        if (keyword) {
                            acc.push({
                                keyword,
                                excludedDomains: row.excludeddomains || row['excluded domains'] || ''
                            });
                        }
                        return acc;
                    }, []);
                }

                if (parsedData.length === 0) {
                    return res.status(400).send('File is empty or does not contain valid data. Check that you have a "keyword" column.');
                }

                const db = await cds.connect.to('db');
                const { 'com.sap.search.SearchTerm': SearchTerms } = db.entities;

                const entriesToInsert = parsedData.map(item => ({
                    keyword: item.keyword,
                    excludedDomains: item.excludedDomains,
                    status: 'Pending'
                }));

                await INSERT.into(SearchTerms).entries(entriesToInsert);
                console.log(`--- [DB] Successfully inserted ${entriesToInsert.length} entries. ---`);

                const messaging = await cds.connect.to('messaging').catch(() => null);
                if (messaging) {
                    await messaging.emit('search/keywords/uploaded', { count: entriesToInsert.length });
                    console.log(`--- [Event] Emitted 'search/keywords/uploaded' event.`);
                }

                return res.status(200).json({
                    message: `Successfully uploaded and saved ${entriesToInsert.length} search terms.`,
                    count: entriesToInsert.length
                });

            } catch (error: any) {
                console.error('--- [Upload Error] ---', error.message);
                return res.status(500).send('An error occurred during file processing.');
            }
        });
    });
});

export default cds.server;
