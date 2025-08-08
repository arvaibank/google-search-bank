using { com.sap.search as my } from '../db/data-model';

//@(requires: 'authenticated-user')
service SearchService {

    @readonly
    entity SearchRuns as projection on my.SearchRun;

    entity TestData as projection on my.TestData;

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