import { type Pool } from "pg";
import { query } from "./db";
import { isNil } from "lodash";

interface MultiValuedPropertyElementMapInput<R> {
	entityId: number
	propertyElement: R
}

export type MultiValuedPropertyElementRowProcessor<R> =
    (propertyElementRow: any) => MultiValuedPropertyElementMapInput<R>;

export interface MultiValuedPropertyElementCollector<R> {
	sql: string
	sqlParams: any[]
	rowProcessor: MultiValuedPropertyElementRowProcessor<R>
}

export const collectMultiValuedProperty = async <R>(
	pool: Pool,
	collector: MultiValuedPropertyElementCollector<R>
): Promise<Map<number, R[]>> => {
	const propertyElementsResult = await query(pool, collector.sql, collector.sqlParams);
	return propertyElementsResult.rows
		.reduce(
			(propMap, currentPropElementRow) => {
				const input = collector.rowProcessor(currentPropElementRow);
				let previousElementSet: R[] | undefined = propMap.get(input.entityId);
				if (!isNil(previousElementSet)) {
					previousElementSet.push(input.propertyElement);
				} else {
					previousElementSet = [input.propertyElement];
				}
				propMap.set(
					input.entityId,
					previousElementSet
				);
				return propMap;
			},
			new Map<number, R[]>()
		);
};
