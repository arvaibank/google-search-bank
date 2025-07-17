import cds, { Service } from '@sap/cds';

console.log("--- [DEBUG] srv/search-service.ts file has been loaded ---");

interface GoogleSearchResultItem {
    title: string;
    link: string;
    snippet: string;
}

export class SearchService extends cds.ApplicationService {
    init() {
        console.log("--- [DEBUG] SearchService init() has been called ---");

        this.on('getSearchResults', async (req: cds.Request) => {
            console.log("--- [DEBUG] 'getSearchResults' handler has been triggered! ---");
            
            const googleApi = await cds.connect.to('GoogleSearchAPI');
            const { keyword, excludedDomains } = req.data;

            if (!keyword) return req.error(400, 'A search keyword is required.');

            const apiKey = process.env.GOOGLE_API_KEY;
            const cx = process.env.GOOGLE_CX;

            if (!apiKey || !cx) {
                console.error("--- [ERROR] API Key or CX is missing from .env file! ---");
                return req.error(500, 'API Key or Search Engine ID is not configured in the environment.');
            }

            let finalQuery = keyword;
            if (excludedDomains) {
                const domains = excludedDomains.split(',').map((d: string) => d.trim()).filter((d: any) => d);
                const exclusionString = domains.map((domain: any) => `-site:${domain}`).join(' ');
                finalQuery = `${keyword} ${exclusionString}`;
            }

            const queryPath = `/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(finalQuery)}&num=10`;
            console.log(`--- [INFO] Executing search with path: ${queryPath} ---`);

            try {
                const externalResponse = await googleApi.get(queryPath);
                const items = externalResponse.items || [];
                console.log(`--- [INFO] Found ${items.length} items from Google API.`);
                return items.map((item: { title: any; link: any; snippet: any; }) => ({ title: item.title, link: item.link, snippet: item.snippet }));
            } catch (error: any) {
                console.error('--- [ERROR] Error calling Google Search API: ---', error.message);
                return req.error(502, 'Failed to retrieve search results.');
            }
        });

        this.on('saveKeywords', async (req: cds.Request) => {
            console.log("--- [HANDLER] 'saveKeywords' handler has been triggered! ---");
            
            const { keywords } = req.data;

            if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
                return req.error(400, 'Request must contain a non-empty array of keywords.');
            }

            console.log(`--- [INFO] Received ${keywords.length} keywords to save.`);

            const { SearchTerms } = this.entities;

            const entriesToInsert = keywords.map((item: any) => ({
                keyword: item.keyword,
                excludedDomains: item.excludedDomains,
                status: 'Pending'
            }));

            await INSERT.into(SearchTerms).entries(entriesToInsert);

            const messaging = await cds.connect.to('messaging').catch(() => {
                console.warn("--- [WARN] Messaging service not connected. Skipping event emission. ---");
                return null;
            });

            if (messaging) {
                await messaging.emit('search/keywords/saved', { count: entriesToInsert.length });
                console.log(`--- [INFO] Emitted 'search/keywords/saved' event for ${entriesToInsert.length} items.`);
            }

            return {
                message: `Successfully received and saved ${entriesToInsert.length} search terms.`,
                count: entriesToInsert.length
            };
        });

        return super.init();
    }
}