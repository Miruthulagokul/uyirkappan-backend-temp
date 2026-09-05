import type {
  Request,
  Response
} from "express";

import type {
  LocationUpdate
} from "./tracking.types.js";


export async function updateAmbulanceLocation(
  req: Request,
  res: Response
) {

  try {

    const body =
      req.body as LocationUpdate;


    if (!body.ambulanceId) {

      return res.status(400).json({
        error: "ambulanceId is required"
      });

    }


    if (!body.requestId) {

      return res.status(400).json({
        error: "requestId is required"
      });

    }


    if (
      typeof body.latitude !== "number" ||
      typeof body.longitude !== "number"
    ) {

      return res.status(400).json({
        error:
          "latitude and longitude must be numbers"
      });

    }


    if (
      body.latitude < -90 ||
      body.latitude > 90
    ) {

      return res.status(400).json({
        error: "Invalid latitude"
      });

    }


    if (
      body.longitude < -180 ||
      body.longitude > 180
    ) {

      return res.status(400).json({
        error: "Invalid longitude"
      });

    }


    console.log(
      "📍 Location received:",
      body
    );


    return res.status(200).json({

      success: true,

      message:
        "Ambulance location received",

      data: body

    });

  } catch (error) {

    console.error(
      "Location update error:",
      error
    );

    return res.status(500).json({
      error:
        "Failed to process location update"
    });

  }
}