import cds from '@sap/cds';
import { Request, Response } from 'express';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { getDestination } from '@sap-cloud-sdk/connectivity';

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

async function callCpiIFlow(payload: any) {
    console.log('--- [CPI LOG] Attempting to get destination "CPI_Google Search_iFlow"...');
    const destination = await getDestination({ destinationName: 'CPI_Google Search_iFlow' });
    if (!destination) {
        throw new Error('BTP Destination "CPI_Google Search_iFlow" not found.');
    }
    console.log('--- [CPI LOG] Successfully retrieved destination.');

    const iFlowEndpoint = destination.url + '/http/https/GoogleSearchJob';

    console.log(`--- [CPI LOG] Sending ${payload.keywords.length} items to CPI endpoint: ${iFlowEndpoint}`);

    const response = await axios.post(iFlowEndpoint, payload, {
        headers: {
            'Authorization': `Bearer ${destination.authTokens[0].value}`,
            'Content-Type': 'application/json'
        },
        responseType: 'arraybuffer'
    });

    console.log(`--- [CPI LOG] Received response from CPI. Status: ${response.status}`);
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
    const tx = cds.tx();
    const { SearchRun } = cds.entities('com.sap.search');
    let runID: string | null = null;

    try {
        const buffer = await getRequestBodyBuffer(req);
        if (buffer.length === 0) return res.status(400).send('File is missing or empty.');

        const parsedData = await parseFileBuffer(buffer);
        
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
        
        const excelBuffer = await callCpiIFlow({ keywords: parsedData });
        
        if (!excelBuffer || excelBuffer.length < 100) {
             throw new Error(`Received an invalid or empty buffer from CPI. Size: ${excelBuffer ? excelBuffer.length : 0} bytes.`);
        }

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
        
        await tx.commit();

        return res.status(200).json({
            message: `Successfully processed ${parsedData.length} keywords.`,
            downloadUrl: `/rest/download/${fileName}`
        });

    } catch (error: any) {
        console.error('--- [FATAL UPLOAD ERROR] ---', error.message);
        await tx.rollback();
        
        if (runID) {
            console.log(`--- [DB LOG] Transaction rolled back for run ID: ${runID}.`);
        }
        return res.status(500).send(`An error occurred: ${error.message}`);
    }
}

cds.on('bootstrap', (app) => {
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