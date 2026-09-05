import {
  Router
} from "express";

import {
  updateAmbulanceLocation
} from "./tracking.controller.js";


const router =
  Router();


router.post(
  "/location",
  updateAmbulanceLocation
);


export default router;