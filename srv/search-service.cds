using { com.sap.search as my } from '../db/data-model';

service SearchService {

    type SearchResult {
        title   : String;
        link    : String;
        snippet : String;
    }

    type KeywordEntry {
        keyword         : String(255);
        excludedDomains : String(1000);
    }

    action getSearchResults(
        keyword          : String,
        excludedDomains  : String default ''
    ) returns array of SearchResult;

    action saveKeywords(keywords: array of KeywordEntry);

    entity SearchTerms as projection on my.SearchTerm;
}
