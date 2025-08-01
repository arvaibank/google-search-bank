namespace com.sap.search;

using { cuid, managed } from '@sap/cds/common';

entity SearchRun : cuid, managed {
    key ID              : UUID;
    fileName        : String(255);
    keywordCount    : Integer;
    status          : String(20) default 'Processing';
    reportUrl       : String;
}

entity SearchTerm : cuid, managed {
    key ID              : UUID;
    keyword         : String(255) not null;
    excludedDomains : String(1000);
    status          : String(20) default 'Pending';
    run             : Association to SearchRun;
}