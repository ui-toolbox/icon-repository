# Schema Initialization

## Supported scenarios
1. Production system
    1. Original schema-creation (auto-detected by checking the existence of the local git repo)
    1. DB data upgrade (missing upgrade-steps always executed)
1. Development server
    1. Original schema-creation (auto-detected by checking the existence of the local git repo)
    1. DB data upgrade (missing upgrade-steps always executed)
1. Integration tests
    1. Full integration tests
        1. Original schema-creation (auto-detected by checking the existence of the local git repo)
        1. DB data upgrade (missing upgrade-steps always executed)
    1. Database only tests
        1. Original schema-creation (auto-detected by checking the existence of the "icon" table)
        1. DB data upgrade (missing upgrade-steps always executed)

## Implementation

### Production system, development server and full-integration-tests
The following environments rely on the on the creation of the original schema and the data-upgrade for subsequent schema versions performed **at the service-level** at each startup:
* production system,
* the development server and
* full-integration-tests

The icon-service performs the following steps:

1. Checks the existence of the local git repo
1. If the local git repo is not found, one is created/initialized along with the first version of the database schema using `createSchema`. The first version of the database schema has an `icon` and an `icon_file` file table (but no `meta` table) which are "drop-created" (descructively created) by `createSchema`.
1. Data- / schema-upgrades to subsequent schema versions are always checked and (if not yet applied) are applied by the *icon-service* on top of the first schema version. The application of upgrades is recorded in the `meta` table.
1. Additionally for full-integration tests, the contents of the tables are deleted (in `beforeEach`) before letting the tests execute (including their addition of their precondition-data...)

### Database-only integration tests
Data-access-level integration tests focus on the database functionality without involving the local git repository. The `beforeEach` method of these tests
1. checks on the existence of the `icon` table to determine whether the first version of the schema is available. (This is in constrast to the service-level tests, where the existence of the local git repo is checked.)
1. If the first version of the DB schema is not yet available, it is created using `createSchema`.
1. The upgrades are applied conditionally.
1. The contents of the tables are deleted before each test execution.