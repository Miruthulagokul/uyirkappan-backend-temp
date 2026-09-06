// ============================================================
// UyirKappan — Dispatch Routes
// ============================================================

import { Router } from "express";

import {
  dispatchDecide,
  dispatchDecideBaseline,
  getAmbulances,
  getAmbulanceById,
  getRoadNetwork,
  getTrafficConditions
} from "./dispatch.controller.js";


const router = Router();


// ----- Ambulances -----

router.get(
  "/ambulances",
  getAmbulances
);

router.get(
  "/ambulances/:id",
  getAmbulanceById
);


// ----- Road Network -----

router.get(
  "/network",
  getRoadNetwork
);


// ----- Traffic -----

router.get(
  "/traffic",
  getTrafficConditions
);


// ----- Dispatch Decision -----

router.post(
  "/dispatch/decide",
  dispatchDecide
);

router.post(
  "/dispatch/decide/baseline",
  dispatchDecideBaseline
);


export default router;
