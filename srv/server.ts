import cds from '@sap/cds';
import { Request, Response } from 'express';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import axios from 'axios';

async function getCpiAuthToken(tokenUrl: string, clientId: string, clientSecret: string): Promise<string> {
    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);

    try {
        const response = await axios.post(tokenUrl, params, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        return response.data.access_token;
    } catch (error) {
        console.error('--- [Auth Error] Failed to fetch CPI OAuth token:', error);
        throw new Error('Failed to authenticate with CPI.');
    }
}

async function callCpiIFlow(payload: any) {
    const iFlowUrl = process.env.CPI_IFLOW_URL;
    const tokenUrl = process.env.CPI_TOKEN_URL;
    const clientId = process.env.CPI_CLIENT_ID;
    const clientSecret = process.env.CPI_CLIENT_SECRET;

    if (!iFlowUrl || !tokenUrl || !clientId || !clientSecret) {
        throw new Error('CPI connection details are not configured in environment variables.');
    }

    console.log('--- [CPI] Fetching access token...');
    const accessToken = await getCpiAuthToken(tokenUrl, clientId, clientSecret);
    console.log('--- [CPI] Access token fetched successfully.');

    console.log(`--- [CPI] Sending ${payload.keywords.length} items to iFlow...`);
    await axios.post(iFlowUrl, payload, {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        }
    });
    console.log('--- [CPI] Successfully sent data to iFlow.');
}

async function parseFileBuffer(buffer: Buffer): Promise<{ keyword: string; excludedDomains: string; }[]> {
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
        const csvString = buffer.toString('utf8');
        const result = Papa.parse(csvString, { header: true, skipEmptyLines: true, transformHeader: header => header.toLowerCase().trim() });
        if (result.errors.length > 0) throw new Error('CSV parsing failed.');
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
        throw new Error('File is empty or does not contain valid data.');
    }

    return parsedData;
}

async function handleFileUpload(req: Request, res: Response) {
    const chunks: any[] = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('error', (err) => {
        console.error('--- [Upload Error] Request stream error:', err);
        return res.status(500).send('An error occurred during file upload.');
    });

    req.on('end', async () => {
        try {
            const buffer = Buffer.concat(chunks);
            if (buffer.length === 0) return res.status(400).send('File is missing or empty.');

            const parsedData = await parseFileBuffer(buffer);
            console.log(`--- [Parser] Successfully parsed ${parsedData.length} entries.`);

            await callCpiIFlow({ keywords: parsedData });

            return res.status(202).json({
                message: `Successfully submitted ${parsedData.length} keywords for processing.`,
                count: parsedData.length
            });

        } catch (error: any) {
            console.error('--- [Upload Error] Failed to process and send file to CPI:', error.message);
            return res.status(500).send(`An error occurred: ${error.message}`);
        }
    });
}

cds.on('bootstrap', (app) => {
    console.log('--- [Bootstrap] Adding custom file upload endpoint (Manual CPI Call). ---');
    app.post('/rest/upload', (req: Request, res: Response) => {
        handleFileUpload(req, res).catch(err => {
            console.error('--- [Fatal Upload Error] ---', err);
            res.status(500).send('A fatal error occurred.');
        });
    });
});

export default cds.server;
