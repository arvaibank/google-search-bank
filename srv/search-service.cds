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

}
