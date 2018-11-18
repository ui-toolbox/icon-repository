import { Pool } from "pg";
import { query } from "./db";
import { map } from "rxjs/operators";
import { List, Map } from "immutable";

interface MultiValuedPropertyElementMapInput<R> {
    entityId: number;
    propertyElement: R;
}

export type MultiValuedPropertyElementRowProcessor<R> =
    (propertyElementRow: any) => MultiValuedPropertyElementMapInput<R>;

export interface MultiValuedPropertyElementCollector<R> {
    sql: string;
    sqlParams: any[];
    rowProcessor: MultiValuedPropertyElementRowProcessor<R>;
}

export const collectMultiValuedProperty
= <R>(
    pool: Pool,
    collector: MultiValuedPropertyElementCollector<R>
) =>
query(pool, collector.sql, collector.sqlParams)
.pipe(
    map(propertyElementsResult =>
        List(propertyElementsResult.rows)
        .reduce<Map<number, List<R>>>(
            (propMap, currentPropElementRow) => {
                const input = collector.rowProcessor(currentPropElementRow);
                const previousElementSet: List<R> = propMap.get(input.entityId);
                return propMap.set(
                    input.entityId,
                    previousElementSet
                        ? previousElementSet.push(input.propertyElement)
                        : List.of(input.propertyElement)
                );
            },
            Map<number, List<R>>()
        ))
);
