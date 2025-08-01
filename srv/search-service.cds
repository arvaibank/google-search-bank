using { com.sap.search as my } from '../db/data-model';

service SearchService {

    // --- ADD THIS ANNOTATION TO GRANT READ ACCESS ---
    @(restrict: [
        { grant: 'READ', to: 'authenticated-user' }
    ])
    @readonly
    entity SearchRuns as projection on my.SearchRun;
    // --- END OF CHANGE ---

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