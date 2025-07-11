namespace com.sap.search;

using { cuid, managed } from '@sap/cds/common';

entity SearchTerm : cuid, managed {
    key ID              : UUID;
    keyword         : String(255) not null;
    excludedDomains : String(1000);
    status          : String(20) default 'Pending';
}
