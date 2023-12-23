import _ from "lodash";

type Limiter = (payload: () => Promise<void>) => Promise<void>;

const limiters: Record<string, Limiter> = {};

export const gitSerializer = "GIT";

export const getSerializer = async (jobType: string): Promise<Limiter> => {
	const pLimit = await import("p-limit");
	if (_.isNil(limiters[jobType])) {
		limiters[jobType] = pLimit.default(1);
	}
	return limiters[jobType];
};
