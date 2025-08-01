import cds from '@sap/cds';
import { Request, Response } from 'express';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import axios from 'axios';
import fs from 'fs';
import path from 'path';

// This is a utility function to get the full request body as a buffer
function getRequestBodyBuffer(req: Request): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const chunks: any[] = [];
        req.on('data', chunk => chunks.push(chunk));
        req.on('end', () => resolve(Buffer.concat(chunks)));
        req.on('error', err => reject(err));
    });
}


const UPLOAD_DIR = path.join(__dirname, '..', '..', 'reports');
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

async function getCpiAuthToken(tokenUrl: string, clientId: string, clientSecret: string): Promise<string> {
    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);
    try {
        const response = await axios.post(tokenUrl, params, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
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

    const accessToken = await getCpiAuthToken(tokenUrl, clientId, clientSecret);
    const response = await axios.post(iFlowUrl, payload, {
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        responseType: 'arraybuffer'
    });
    return response.data;
}

async function parseFileBuffer(buffer: Buffer): Promise<{ keyword: string; excludedDomains: string; }[]> {
    let parsedData: { keyword: string; excludedDomains: string; }[] = [];
    const findHeader = (row: any, potentialNames: string[]) => {
        for (const name of potentialNames) {
            const foundKey = Object.keys(row).find(key => key.toLowerCase().trim() === name);
            if (foundKey) return row[foundKey];
        }
        return undefined;
    };

    try {
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData: any[] = XLSX.utils.sheet_to_json(sheet);
        parsedData = jsonData.map(row => ({
            keyword: findHeader(row, ['keyword', 'keywords']),
            excludedDomains: findHeader(row, ['excludeddomains', 'excluded domains']) || ''
        })).filter(item => item.keyword);
    } catch (xlsxError) {
        const csvString = buffer.toString('utf8');
        const result = Papa.parse(csvString, { header: true, skipEmptyLines: true, transformHeader: h => h.toLowerCase().trim() });
        if (result.errors.length > 0) throw new Error('CSV parsing failed.');
        parsedData = (result.data as any[]).map(row => ({
            keyword: row.keyword || row.keywords,
            excludedDomains: row.excludeddomains || row['excluded domains'] || ''
        })).filter(item => item.keyword);
    }

    if (parsedData.length === 0) throw new Error('File does not contain valid data.');
    return parsedData;
}

async function handleFileUpload(req: Request, res: Response) {
    console.log('--- [SERVER LOG] File upload request received.');
    
    const tx = cds.tx();
    const { SearchRun } = cds.entities('com.sap.search');
    let runID: string | null = null;

    try {
        const buffer = await getRequestBodyBuffer(req);
        if (buffer.length === 0) return res.status(400).send('File is missing or empty.');
        console.log('--- [SERVER LOG] File buffer received successfully.');

        const parsedData = await parseFileBuffer(buffer);
        console.log(`--- [SERVER LOG] Successfully parsed ${parsedData.length} entries.`);
        
        const newRunID = cds.utils.uuid();
        runID = newRunID;
        
        await tx.run(
            INSERT.into(SearchRun).entries({
                ID: runID,
                fileName: req.headers['x-filename'] as string || 'unknown.xlsx',
                keywordCount: parsedData.length,
                status: 'Processing'
            })
        );
        console.log(`--- [DB LOG] Successfully created SearchRun with ID: ${runID}`);

        const excelBuffer = await callCpiIFlow({ keywords: parsedData });
        console.log('--- [SERVER LOG] Successfully received Excel file from CPI.');

        const timestamp = new Date().toISOString().replace(/:/g, '-');
        const fileName = `Report-${runID}-${timestamp}.xlsx`;
        const filePath = path.join(UPLOAD_DIR, fileName);
        fs.writeFileSync(filePath, excelBuffer);
        
        await tx.run(
            UPDATE(SearchRun, runID).with({
                status: 'Success',
                reportUrl: `/rest/download/${fileName}`
            })
        );
        console.log(`--- [DB LOG] Successfully updated SearchRun ${runID} to 'Success'.`);

        await tx.commit();

        return res.status(200).json({
            message: `Successfully processed ${parsedData.length} keywords.`,
            downloadUrl: `/rest/download/${fileName}`
        });

    } catch (error: any) {
        console.error('--- [FATAL UPLOAD ERROR] ---', error.message);
        if (tx.isDraft) await tx.rollback();

        if (runID) {
            console.log(`--- [DB LOG] Transaction rolled back for run ID: ${runID}.`);
        }
        return res.status(500).send(`An error occurred: ${error.message}`);
    }
}

cds.on('bootstrap', (app) => {
    console.log('--- [Bootstrap] Adding custom file upload and download endpoints. ---');
    app.post('/rest/upload', handleFileUpload);
    app.get('/rest/download/:filename', (req, res) => {
        const { filename } = req.params;
        const filePath = path.join(UPLOAD_DIR, filename);
        if (fs.existsSync(filePath)) {
            res.download(filePath);
        } else {
            res.status(404).send('File not found.');
        }
    });
});

export default cds.server;