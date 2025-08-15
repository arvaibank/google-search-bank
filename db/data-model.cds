namespace com.sap.search;

using { cuid, managed } from '@sap/cds/common';

entity SearchRun : cuid, managed {
    key ID              : UUID;
    fileName        : String(255);
    keywordCount    : Integer;
    status          : String(20) default 'Processing';
    reportUrl       : String;
    runtimeInSeconds: Integer;
    terms           : Composition of many SearchTerm on terms.run = $self;
}

entity SearchTerm : cuid {
    key ID              : UUID;
    keyword         : String(255) not null;
    excludedDomains : String(1000);
    run             : Association to SearchRun;
}