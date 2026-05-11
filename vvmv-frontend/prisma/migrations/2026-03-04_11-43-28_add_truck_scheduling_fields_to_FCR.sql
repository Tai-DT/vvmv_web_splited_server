-- Create the migration file for adding truck scheduling fields to FCR model

-- Adding truckingNumberId foreign key relationship
ALTER TABLE FCR
ADD COLUMN truckingNumberId INT,
ADD FOREIGN KEY (truckingNumberId) REFERENCES TruckingNumbers(id);

-- Adding tripNumber field for multiple trips per truck
ALTER TABLE FCR
ADD COLUMN tripNumber INT;

-- Adding index on implementationDate
CREATE INDEX idx_implementationDate ON FCR (implementationDate);