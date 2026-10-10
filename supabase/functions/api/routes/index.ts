import { Router } from "npm:express@4.18.2";
import { healthRouter } from "./health.ts";
import { meRouter } from "./me.ts";
import { publicRouter } from "./public.ts";
import { announcementsRouter } from "./announcements.ts";
import { membershipRouter } from "./membership.ts";
import { doorRouter } from "./door.ts";
import { checkoutRouter } from "./checkout.ts";
import { eventsAdminRouter } from "./eventsAdmin.ts";
import { merchAdminRouter } from "./merchAdmin.ts";
import { fundraisersRouter } from "./fundraisers.ts";
import { treasurerRouter } from "./treasurer.ts";

export const router = Router();

router.use(healthRouter);
router.use(publicRouter);
router.use(announcementsRouter);
router.use(meRouter);
router.use(membershipRouter);
router.use(doorRouter);
router.use(checkoutRouter);
router.use(eventsAdminRouter);
router.use(merchAdminRouter);
router.use(fundraisersRouter);
router.use(treasurerRouter);
