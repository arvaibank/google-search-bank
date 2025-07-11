using { com.sap.search as my } from '../db/data-model';

service SearchService {

    type SearchResult {
        title   : String;
        link    : String;
        snippet : String;
    }

    action getSearchResults(
        keyword          : String,
        excludedDomains  : String default ''
    ) returns array of SearchResult;

    entity SearchTerms as projection on my.SearchTerm;
}
