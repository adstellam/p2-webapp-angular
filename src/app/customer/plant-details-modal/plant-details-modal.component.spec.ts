import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PlantDetailsModalComponent } from './plant-details-modal.component';

describe('PlantDetailsModalComponent', () => {
  let component: PlantDetailsModalComponent;
  let fixture: ComponentFixture<PlantDetailsModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ PlantDetailsModalComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(PlantDetailsModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
